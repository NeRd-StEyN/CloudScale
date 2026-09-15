import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import httpProxy from 'http-proxy';
import Database from 'better-sqlite3';
import { clerkMiddleware, requireAuth } from '@clerk/express';

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

// Clerk Middleware
app.use(clerkMiddleware());

// In-memory logs
const deploymentLogs: Record<string, string[]> = {};

// Deployment API
app.post('/api/deploy', requireAuth(), (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

  // Get next available port
  const maxPortStmt = db.prepare('SELECT MAX(port) as maxPort FROM deployments');
  const result = maxPortStmt.get() as { maxPort: number | null };
  const port = (result.maxPort || 4000) + 1;

  const id = generateId();
  const userId = req.auth.userId;
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

  log(`Cloning repository into ${repoPath}...`);
  exec(`git clone ${repoUrl} ${repoPath}`, (err, stdout, stderr) => {
    if (err) {
      log(`Git Clone Failed: ${stderr}`);
      db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
      return;
    }
    log(`Repository cloned successfully.`);
    log(`Running npm install...`);
    
    const install = spawn('npm', ['install'], { cwd: repoPath, shell: true });
    
    install.stdout.on('data', data => log(data.toString()));
    install.stderr.on('data', data => log(data.toString()));
    
    install.on('close', code => {
      if (code !== 0) {
        log(`npm install failed with code ${code}`);
        db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('failed', id);
        return;
      }
      
      log(`npm install completed. Starting application on port ${port}...`);
      
      const start = spawn('npm', ['start'], { 
        cwd: repoPath, 
        env: { ...process.env, PORT: port.toString() },
        shell: true
      });
      
      start.stdout.on('data', data => log(data.toString()));
      start.stderr.on('data', data => log(data.toString()));
      
      db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('active', id);
      log(`Deployment active at http://${id}.localhost:${PORT}`);
    });
  });
});

app.get('/api/services', requireAuth(), (req, res) => {
  const userId = req.auth.userId;
  const stmt = db.prepare('SELECT * FROM deployments WHERE userId = ? ORDER BY createdAt DESC');
  const services = stmt.all(userId);
  res.json({ services });
});

app.get('/api/logs/:id', requireAuth(), (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  const stmt = db.prepare('SELECT id FROM deployments WHERE id = ? AND userId = ?');
  if (!stmt.get(id, userId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json({ logs: deploymentLogs[id] || [] });
});

app.listen(PORT, () => {
  console.log(`CloudScale Deployment Server listening on port ${PORT}`);
});
