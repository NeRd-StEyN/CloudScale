import 'dotenv/config'; // force restart
import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import httpProxy from 'http-proxy';
import Database from 'better-sqlite3';
import os from 'os';
import { clerkMiddleware, requireAuth, clerkClient, getAuth } from '@clerk/express';

const app = express();
const proxy = httpProxy.createProxyServer({});
const PORT = process.env.PORT || 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEPLOYMENTS_DIR = path.resolve(__dirname, '.deployments');

// Initialize SQLite DB
const db = new Database('deployments.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    repoUrl TEXT NOT NULL,
    port INTEGER NOT NULL,
    status TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(cors());
app.use(express.json());

// Ensure deployments dir exists
if (!fs.existsSync(DEPLOYMENTS_DIR)) {
  fs.mkdirSync(DEPLOYMENTS_DIR);
}

// Generate a random subdomain ID
const generateId = () => Math.random().toString(36).substring(2, 8);

// Subdomain proxy middleware - must be BEFORE clerkMiddleware since we don't need auth to view sites
app.use((req, res, next) => {
  const host = req.hostname;
  const parts = host.split('.');
  if (parts.length > 1 && parts[0] !== 'localhost') {
    const subdomain = parts[0];
    const stmt = db.prepare('SELECT port FROM deployments WHERE id = ?');
    const deployment = stmt.get(subdomain) as { port: number } | undefined;
    if (deployment) {
      proxy.web(req, res, { target: `http://localhost:${deployment.port}` }, (err) => {
        res.status(502).send(`Bad Gateway: ${err.message}`);
      });
      return;
    }
  }
  next();
});

// Clerk Middleware - pass keys explicitly so they are always loaded
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

// In-memory logs
const deploymentLogs: Record<string, string[]> = {};

// Deployment API
app.post('/api/deploy', requireAuth(), (req, res) => {
  const userId = getAuth(req).userId;
  const { repoUrl, branch, envVars } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

  const userEnv: Record<string, string> = envVars && typeof envVars === 'object' ? envVars : {};

  // Get next available port
  const maxPortStmt = db.prepare('SELECT MAX(port) as maxPort FROM deployments');
  const result = maxPortStmt.get() as { maxPort: number | null };
  const port = (result.maxPort || 4000) + 1;

  const id = generateId();
  const repoPath = path.join(DEPLOYMENTS_DIR, id);
  
  // Save to DB initially
  const insertStmt = db.prepare('INSERT INTO deployments (id, userId, repoUrl, port, status) VALUES (?, ?, ?, ?, ?)');
  insertStmt.run(id, userId, repoUrl, port, 'deploying');
  
  deploymentLogs[id] = [`Initializing deployment for ${repoUrl}...`];
  const log = (msg: string) => {
    console.log(`[${id}] ${msg}`);
    deploymentLogs[id].push(msg);
  };

  res.json({ id, url: `http://${id}.localhost:${PORT}`, status: 'deploying' });

  // Clone branch if specified
  const cloneCmd = branch ? `git clone --branch ${branch} --single-branch ${repoUrl} ${repoPath}` : `git clone ${repoUrl} ${repoPath}`;
  log(`Cloning repository${branch ? ` (branch: ${branch})` : ''}...`);
  exec(cloneCmd, async (err, _stdout, stderr) => {
    if (err) {
      log(`❌ Git Clone Failed: ${stderr}`);
      db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
      return;
    }
    log(`✅ Repository cloned. Running buildpack detection...`);

    // ─── WRITE USER-PROVIDED ENV VARS TO .env ────────────────────────────
    if (Object.keys(userEnv).length > 0) {
      const envContent = Object.entries(userEnv)
        .map(([k, v]) => `${k}=${v.includes(' ') || v.includes('#') ? `"${v}"` : v}`)
        .join('\n');
      fs.writeFileSync(path.join(repoPath, '.env'), envContent + '\n', 'utf8');
      log(`🔐 Written ${Object.keys(userEnv).length} environment variable(s) to .env`);
    }

    // ─── FULL-STACK DETECTION ─────────────────────────────────────────────
    // Look for common full-stack folder structures
    const has = (f: string) => fs.existsSync(path.join(repoPath, f));
    const isDir = (f: string) => { try { return fs.statSync(path.join(repoPath, f)).isDirectory(); } catch { return false; } };

    // Possible client/server folder name pairs
    const clientDirs = ['client', 'frontend', 'web', 'app', 'ui'];
    const serverDirs = ['server', 'backend', 'api', 'service'];
    const foundClient = clientDirs.find(d => isDir(d) && fs.existsSync(path.join(repoPath, d, 'package.json')));
    const foundServer = serverDirs.find(d => isDir(d) && fs.existsSync(path.join(repoPath, d, 'package.json')));

    if (foundClient && foundServer) {
      // ── FULL-STACK PROJECT ──────────────────────────────────────────────
      log(`🏗️  Full-stack project detected! Client: /${foundClient}  Server: /${foundServer}`);

      const clientPath = path.join(repoPath, foundClient);
      const serverPath = path.join(repoPath, foundServer);
      const frontendPort = port + 1;

      const readPkg = (dir: string) => {
        try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return {}; }
      };

      const clientPkg = readPkg(clientPath);
      const serverPkg = readPkg(serverPath);
      const clientDeps = { ...clientPkg.dependencies, ...clientPkg.devDependencies };
      const serverScripts = serverPkg.scripts || {};

      // Figure out client build command
      const clientBuildCmd = clientPkg.scripts?.build ? ['npm', 'run', 'build'] : null;
      const clientServeCmd = clientDeps['vite'] || clientDeps['@vitejs/plugin-react']
        ? ['npx', 'vite', 'preview', '--port', frontendPort.toString(), '--host']
        : clientDeps['react-scripts']
        ? ['npx', 'serve', '-s', 'build', '-l', frontendPort.toString()]
        : clientDeps['next']
        ? ['npm', 'start']
        : clientPkg.scripts?.dev
        ? ['npm', 'run', 'dev']
        : ['npm', 'start'];

      const serverServeCmd = serverScripts['start']
        ? ['npm', 'start']
        : serverScripts['dev']
        ? ['npm', 'run', 'dev']
        : serverPkg.main
        ? ['node', serverPkg.main]
        : ['node', 'index.js'];

      const installIn = (dir: string, name: string) => new Promise<void>((resolve, reject) => {
        const mgr = fs.existsSync(path.join(dir, 'yarn.lock')) ? ['yarn']
                  : fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ? ['pnpm', 'install']
                  : ['npm', 'install'];
        log(`📦 Installing ${name} dependencies...`);
        const proc = spawn(mgr[0], mgr.slice(1), { cwd: dir, shell: true });
        proc.stdout.on('data', d => log(`[${name}] ${d.toString().trim()}`));
        proc.stderr.on('data', d => log(`[${name}] ${d.toString().trim()}`));
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`${name} install failed`)));
      });

      const buildIn = (dir: string, cmd: string[], name: string) => new Promise<void>((resolve) => {
        log(`🔨 Building ${name}: ${cmd.join(' ')}...`);
        const proc = spawn(cmd[0], cmd.slice(1), { cwd: dir, shell: true });
        proc.stdout.on('data', d => log(`[${name}] ${d.toString().trim()}`));
        proc.stderr.on('data', d => log(`[${name}] ${d.toString().trim()}`));
        proc.on('close', code => { if (code !== 0) log(`⚠️ ${name} build exited ${code}`); resolve(); });
      });

      try {
        // Install both
        await installIn(serverPath, 'server');
        await installIn(clientPath, 'client');

        // Build client
        if (clientBuildCmd) await buildIn(clientPath, clientBuildCmd, 'client');

        // Start backend
        log(`🚀 Starting backend on port ${port}...`);
        const backProc = spawn(serverServeCmd[0], serverServeCmd.slice(1), {
          cwd: serverPath,
          env: { ...process.env, PORT: port.toString(), HOST: '0.0.0.0', CLIENT_URL: `http://localhost:${frontendPort}` },
          shell: true
        });
        backProc.stdout.on('data', d => log(`[server] ${d.toString().trim()}`));
        backProc.stderr.on('data', d => log(`[server] ${d.toString().trim()}`));

        // Start frontend
        log(`🚀 Starting frontend on port ${frontendPort}...`);
        const frontProc = spawn(clientServeCmd[0], clientServeCmd.slice(1), {
          cwd: clientPath,
          env: { ...process.env, PORT: frontendPort.toString(), VITE_API_URL: `http://localhost:${port}`, REACT_APP_API_URL: `http://localhost:${port}` },
          shell: true
        });
        frontProc.stdout.on('data', d => log(`[client] ${d.toString().trim()}`));
        frontProc.stderr.on('data', d => log(`[client] ${d.toString().trim()}`));

        setTimeout(() => {
          db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('active', id);
          log(`✅ Full-stack deployment live!`);
          log(`   Frontend → http://${id}.localhost:${PORT} (proxied to port ${frontendPort})`);
          log(`   Backend  → port ${port}`);
          // Update proxy to point to frontend port for this deployment
          db.prepare('UPDATE deployments SET port = ? WHERE id = ?').run(frontendPort, id);
        }, 8000);
      } catch (e: any) {
        log(`❌ ${e.message}`);
        db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
      }
      return; // Skip single-project detection below
    }

    // ─── SINGLE-PROJECT BUILDPACK DETECTION ───────────────────────────────
    let runtime = 'unknown';
    let installCmd: string[] | null = null;
    let buildCmd: string[] | null = null;
    let serveCmd: string[] = [];
    let framework = 'Unknown';

    // ── Read package.json if exists ──
    let pkgJson: any = {};
    if (has('package.json')) {
      try { pkgJson = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf8')); } catch {}
    }
    const scripts = pkgJson.scripts || {};
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    if (has('package.json')) {
      runtime = 'node';
      installCmd = has('yarn.lock') ? ['yarn', '--frozen-lockfile'] 
                 : has('pnpm-lock.yaml') ? ['pnpm', 'install', '--frozen-lockfile']
                 : ['npm', 'install'];

      // Framework detection – most specific first
      if (deps['next']) {
        framework = 'Next.js';
        buildCmd = scripts['build'] ? ['npm', 'run', 'build'] : null;
        serveCmd = ['npm', 'start'];
      } else if (deps['@nuxtjs/nuxt'] || deps['nuxt']) {
        framework = 'Nuxt.js';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npm', 'run', 'start'];
      } else if (deps['@remix-run/react'] || deps['@remix-run/node']) {
        framework = 'Remix';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npm', 'start'];
      } else if (deps['astro']) {
        framework = 'Astro';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npx', 'astro', 'preview', '--port', port.toString(), '--host'];
      } else if (deps['@nestjs/core']) {
        framework = 'NestJS';
        buildCmd = scripts['build'] ? ['npm', 'run', 'build'] : null;
        serveCmd = scripts['start:prod'] ? ['npm', 'run', 'start:prod'] : ['npm', 'start'];
      } else if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
        framework = deps['vue'] ? 'Vue + Vite' : deps['svelte'] ? 'Svelte + Vite' : 'React + Vite';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npx', 'vite', 'preview', '--port', port.toString(), '--host'];
      } else if (deps['react-scripts']) {
        framework = 'Create React App';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npx', 'serve', '-s', 'build', '-l', port.toString()];
      } else if (deps['gatsby']) {
        framework = 'Gatsby';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npx', 'gatsby', 'serve', '-p', port.toString()];
      } else if (deps['@angular/core']) {
        framework = 'Angular';
        buildCmd = ['npm', 'run', 'build'];
        serveCmd = ['npx', 'serve', '-s', 'dist', '-l', port.toString()];
      } else if (deps['express'] || deps['fastify'] || deps['koa'] || deps['hapi']) {
        framework = deps['fastify'] ? 'Fastify' : deps['koa'] ? 'Koa' : deps['hapi'] ? 'Hapi' : 'Express';
        serveCmd = scripts['start'] ? ['npm', 'start'] : ['node', pkgJson.main || 'index.js'];
      } else if (scripts['start']) {
        framework = 'Node.js';
        serveCmd = ['npm', 'start'];
      } else if (scripts['dev']) {
        framework = 'Node.js (dev)';
        serveCmd = ['npm', 'run', 'dev'];
      } else if (pkgJson.main) {
        framework = 'Node.js';
        serveCmd = ['node', pkgJson.main];
      } else {
        // Static fallback if index.html exists
        if (has('index.html')) {
          framework = 'Static HTML';
          runtime = 'static';
          serveCmd = ['npx', 'serve', '.', '-l', port.toString()];
          installCmd = null;
        }
      }
    } else if (has('requirements.txt') || has('Pipfile') || has('pyproject.toml')) {
      runtime = 'python';
      framework = 'Python';
      installCmd = has('requirements.txt') ? ['pip', 'install', '-r', 'requirements.txt']
                 : has('Pipfile') ? ['pipenv', 'install'] : ['pip', 'install', '-e', '.'];
      // Detect web framework
      const reqs = has('requirements.txt') ? fs.readFileSync(path.join(repoPath, 'requirements.txt'), 'utf8') : '';
      if (reqs.toLowerCase().includes('fastapi')) {
        framework = 'FastAPI';
        serveCmd = ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', port.toString()];
      } else if (reqs.toLowerCase().includes('django')) {
        framework = 'Django';
        serveCmd = ['python', 'manage.py', 'runserver', `0.0.0.0:${port}`];
      } else if (reqs.toLowerCase().includes('flask')) {
        framework = 'Flask';
        serveCmd = ['python', 'app.py'];
      } else if (has('main.py')) {
        serveCmd = ['python', 'main.py'];
      } else if (has('app.py')) {
        serveCmd = ['python', 'app.py'];
      } else {
        serveCmd = ['python', 'main.py'];
      }
    } else if (has('go.mod')) {
      runtime = 'go';
      framework = 'Go';
      installCmd = null;
      buildCmd = ['go', 'build', '-o', 'app', '.'];
      serveCmd = ['./app'];
    } else if (has('Cargo.toml')) {
      runtime = 'rust';
      framework = 'Rust';
      installCmd = null;
      buildCmd = ['cargo', 'build', '--release'];
      const cargoToml = fs.readFileSync(path.join(repoPath, 'Cargo.toml'), 'utf8');
      const nameMatch = cargoToml.match(/name\s*=\s*"([^"]+)"/);
      const binName = nameMatch ? nameMatch[1] : 'app';
      serveCmd = [`./target/release/${binName}`];
    } else if (has('pom.xml') || has('build.gradle')) {
      runtime = 'java';
      framework = has('pom.xml') ? 'Spring Boot (Maven)' : 'Spring Boot (Gradle)';
      installCmd = null;
      buildCmd = has('pom.xml') ? ['mvn', 'package', '-DskipTests'] : ['./gradlew', 'build'];
      serveCmd = has('pom.xml') 
        ? ['java', '-jar', `target/${path.basename(repoPath)}.jar`]
        : ['java', '-jar', `build/libs/${path.basename(repoPath)}.jar`];
    } else if (has('Gemfile')) {
      runtime = 'ruby';
      framework = 'Ruby on Rails';
      installCmd = ['bundle', 'install'];
      serveCmd = ['bundle', 'exec', 'rails', 'server', '-p', port.toString(), '-b', '0.0.0.0'];
    } else if (has('composer.json')) {
      runtime = 'php';
      framework = 'PHP / Laravel';
      installCmd = ['composer', 'install'];
      serveCmd = ['php', 'artisan', 'serve', `--port=${port}`, '--host=0.0.0.0'];
    } else if (has('index.html')) {
      runtime = 'static';
      framework = 'Static HTML';
      installCmd = null;
      serveCmd = ['npx', 'serve', '.', '-l', port.toString()];
    } else {
      log(`❌ Could not detect any known runtime/framework. Aborting.`);
      db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
      return;
    }

    log(`🔍 Detected: ${framework} (runtime: ${runtime})`);

    // ─── STEP 1: INSTALL ─────────────────────────────────────────────────
    const runInstall = () => new Promise<void>((resolve, reject) => {
      if (!installCmd) { log(`⏭ No install step needed.`); return resolve(); }
      log(`📦 Installing dependencies: ${installCmd.join(' ')}...`);
      const proc = spawn(installCmd![0], installCmd!.slice(1), { cwd: repoPath, shell: true });
      proc.stdout.on('data', d => log(d.toString()));
      proc.stderr.on('data', d => log(d.toString()));
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Install failed (code ${code})`)));
    });

    // ─── STEP 2: BUILD ───────────────────────────────────────────────────
    const runBuild = () => new Promise<void>((resolve) => {
      if (!buildCmd) { log(`⏭ No build step needed.`); return resolve(); }
      log(`🔨 Building: ${buildCmd.join(' ')}...`);
      const proc = spawn(buildCmd![0], buildCmd!.slice(1), { cwd: repoPath, shell: true });
      proc.stdout.on('data', d => log(d.toString()));
      proc.stderr.on('data', d => log(d.toString()));
      proc.on('close', code => {
        if (code !== 0) log(`⚠️ Build exited with code ${code} — attempting to serve anyway...`);
        resolve();
      });
    });

    // ─── STEP 3: SERVE ───────────────────────────────────────────────────
    const runServe = () => {
      log(`🚀 Starting: ${serveCmd.join(' ')} on port ${port}...`);
      const proc = spawn(serveCmd[0], serveCmd.slice(1), {
        cwd: repoPath,
        env: { ...process.env, PORT: port.toString(), HOST: '0.0.0.0' },
        shell: true
      });
      proc.stdout.on('data', d => log(d.toString()));
      proc.stderr.on('data', d => log(d.toString()));
      proc.on('close', code => {
        log(`⚠️ Server process exited with code ${code}`);
        db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
      });
      setTimeout(() => {
        db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('active', id);
        log(`✅ Deployment live at http://${id}.localhost:${PORT}`);
      }, 6000);
    };

    try {
      await runInstall();
      await runBuild();
      runServe();
    } catch (e: any) {
      log(`❌ ${e.message}`);
      db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
    }
  });
});


app.get('/api/services', requireAuth(), (req, res) => {
  const userId = getAuth(req).userId;
  const stmt = db.prepare('SELECT * FROM deployments WHERE userId = ? ORDER BY createdAt DESC');
  const services = stmt.all(userId);
  res.json({ services });
});

app.get('/api/debug/repos', async (req, res) => {
  try {
    const userId = 'user_2mC4m3aI5h9yL1aP4iX7mJ2yU9v'; // We will fetch the correct userId first
    // Let's just fetch all users and find nipun0411 to be robust
    const users = await clerkClient.users.getUserList();
    const user = users.data.find(u => u.emailAddresses[0]?.emailAddress === 'nipun0411@gmail.com');
    if (!user) return res.json({ error: 'User not found' });
    
    const response = await clerkClient.users.getUserOauthAccessToken(user.id, 'github');
    const token = response.data?.[0]?.token;
    if (!token) return res.json({ error: 'No token' });
    
    const githubRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CloudScale-Local'
      }
    });

    if (!githubRes.ok) {
      return res.json({ error: `GitHub API error: ${githubRes.status}`, details: await githubRes.text() });
    }

    const repos = await githubRes.json();
    if (!Array.isArray(repos)) {
       return res.json({ error: 'Repos is not an array', repos });
    }
    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url
    }));

    res.json({ repos: formattedRepos });
  } catch (err: any) {
    res.json({ error: err.message, stack: err.stack });
  }
});

app.get('/api/github/repos', requireAuth(), async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const response = await clerkClient.users.getUserOauthAccessToken(userId, 'github');
    const token = response.data?.[0]?.token;
    
    if (!token) {
      return res.status(404).json({ error: 'GitHub not connected or token missing' });
    }

    const githubRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CloudScale-Local'
      }
    });

    if (!githubRes.ok) {
      throw new Error(`GitHub API error: ${githubRes.status}`);
    }

    const repos = await githubRes.json();
    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      private: repo.private
    }));

    res.json({ repos: formattedRepos });
  } catch (err: any) {
    fs.appendFileSync('error.log', `[${new Date().toISOString()}] ERROR: ${err.message}\n${err.stack}\n\n`);
    console.error('Error fetching github repos:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/branches', requireAuth(), async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { owner, repo } = req.query as { owner: string; repo: string };
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

    const response = await clerkClient.users.getUserOauthAccessToken(userId, 'github');
    const token = response.data?.[0]?.token;
    if (!token) return res.status(404).json({ error: 'GitHub not connected' });

    const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CloudScale-Local'
      }
    });
    if (!branchRes.ok) return res.status(branchRes.status).json({ error: 'GitHub API error' });
    const data = await branchRes.json();
    res.json({ branches: data.map((b: any) => b.name) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Session network counters
let _lastNetBytes = 0;
let _sessionNetGb = 0;

app.get('/api/metrics', (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU: sample over 200ms
    const cpuStart = os.cpus().map(c => c.times);
    setTimeout(() => {
      const cpuEnd = os.cpus().map(c => c.times);
      let totalDelta = 0, idleDelta = 0;
      cpuEnd.forEach((end, i) => {
        const start = cpuStart[i];
        const total = Object.keys(end).reduce((s, k) => s + (end as any)[k] - (start as any)[k], 0);
        totalDelta += total;
        idleDelta += end.idle - start.idle;
      });
      const cpuPercent = totalDelta === 0 ? 0 : Math.round((1 - idleDelta / totalDelta) * 100);

      res.json({
        memUsedMb: Math.round(usedMem / 1024 / 1024),
        memTotalMb: Math.round(totalMem / 1024 / 1024),
        cpuPercent,
        bandwidthGb: parseFloat(_sessionNetGb.toFixed(3))
      });
    }, 200);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs/:id', requireAuth(), (req, res) => {
  const userId = getAuth(req).userId;
  const { id } = req.params;
  const stmt = db.prepare('SELECT id FROM deployments WHERE id = ? AND userId = ?');
  if (!stmt.get(id, userId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json({ logs: deploymentLogs[id] || [] });
});

app.listen(PORT, () => {
  console.log(`CloudScale Deployment Server listening on port ${PORT}`);
});
