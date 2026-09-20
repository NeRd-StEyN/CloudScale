import React, { useState, useEffect } from 'react';
import { ThreeGlobeMesh } from './ThreeGlobeMesh.tsx';
import { CloudScaleLogo } from './CloudScaleLogo.tsx';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

interface LandingPageProps {
  onNavigateToConsole: () => void;
  onOpenDocs?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToConsole }) => {
  const [activeTab, setActiveTab] = useState<'git' | 'config' | 'docker'>('git');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [cliCopyState, setCliCopyState] = useState<'idle' | 'copied'>('idle');
  const [vcpuCores, setVcpuCores] = useState<number>(32);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [prStatus, setPrStatus] = useState<string>('ACTIVE PR #142');
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [telemetryReqs, setTelemetryReqs] = useState<string>('14.2M/s');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [demoModalOpen, setDemoModalOpen] = useState<boolean>(false);
  const [pings, setPings] = useState({
    sfo: 8,
    fra: 14,
    sin: 21,
    iad: 5,
  });

  // Telemetry fluctuation effect
  useEffect(() => {
    const interval = setInterval(() => {
      const val = (14.0 + Math.random() * 0.4).toFixed(1);
      setTelemetryReqs(`${val}M/s`);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyNpx = () => {
    navigator.clipboard.writeText('npx cloudscale init');
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 2200);
  };

  const handleCopyBrew = () => {
    navigator.clipboard.writeText('brew install cloudscale-cli');
    setCliCopyState('copied');
    setTimeout(() => setCliCopyState('idle'), 2200);
  };

  const triggerPingRefresh = () => {
    setIsPinging(true);
    setTimeout(() => {
      setPings({
        sfo: Math.floor(7 + Math.random() * 4),
        fra: Math.floor(13 + Math.random() * 4),
        sin: Math.floor(19 + Math.random() * 5),
        iad: Math.floor(4 + Math.random() * 4),
      });
      setIsPinging(false);
    }, 600);
  };

  const simulateRollback = () => {
    if (isRollingBack) return;
    setIsRollingBack(true);
    setTimeout(() => {
      setPrStatus('RESTORED COMMIT #141');
      setIsRollingBack(false);
      setTimeout(() => {
        setPrStatus('ACTIVE PR #142');
      }, 3500);
    }, 700);
  };

  return (
    <div className="bg-[#131315] text-[#e5e1e4] min-h-screen selection:bg-[#10b981] selection:text-[#002113] cyber-grid relative overflow-x-hidden">
      {/* Fixed Navigation Bar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#0e0e10]/85 backdrop-blur-xl border-b border-[#3c4a42]/30 shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
        <div className="h-16 max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left brand */}
          <div className="flex items-center gap-3">
            <CloudScaleLogo className="h-8 w-auto object-contain transition-transform hover:scale-105 duration-200" />
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 text-left cursor-pointer"
            >
              <span className="text-lg font-semibold text-[#e5e1e4] tracking-tight">CloudScale</span>
              <span className="px-2 py-0.5 rounded-full bg-[#2a2a2c] font-mono text-xs text-[#4edea3] border border-[#4edea3]/20 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4edea3]"></span>
                </span>
                v2.4
              </span>
            </button>
          </div>

          {/* Navigation links */}
          <nav className="hidden lg:flex items-center gap-1">
            <a
              href="#capabilities"
              className="px-3 py-1.5 rounded text-sm text-[#bbcabf] hover:bg-[#1c1b1d] hover:text-[#e5e1e4] transition-colors"
            >
              Features
            </a>
            <a
              href="#comparison"
              className="px-3 py-1.5 rounded text-sm text-[#bbcabf] hover:bg-[#1c1b1d] hover:text-[#e5e1e4] transition-colors"
            >
              Comparison
            </a>
            <a
              href="#architecture"
              className="px-3 py-1.5 rounded text-sm text-[#bbcabf] hover:bg-[#1c1b1d] hover:text-[#e5e1e4] transition-colors"
            >
              Architecture
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded text-sm text-[#bbcabf] hover:bg-[#1c1b1d] hover:text-[#e5e1e4] transition-colors"
            >
              GitHub
            </a>
            <button
              onClick={() => onNavigateToConsole()}
              className="px-3 py-1.5 rounded text-sm text-[#bbcabf] hover:bg-[#1c1b1d] hover:text-[#e5e1e4] transition-colors"
            >
              Docs
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="hidden sm:inline-flex px-3 py-1.5 rounded text-sm text-[#bbcabf] hover:bg-[#1c1b1d] hover:text-[#e5e1e4] transition-colors cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <button
              onClick={onNavigateToConsole}
              className="animate-shimmer px-4 py-1.5 rounded text-sm font-semibold bg-[#4edea3] text-[#003824] hover:bg-[#6ffbbe] transition-all shadow-[0_0_16px_rgba(78,222,163,0.35)] active:scale-95 duration-150 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">terminal</span>
              <span>Open Console</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-8 h-8 rounded bg-[#1c1b1d] border border-[#3c4a42]/40 flex items-center justify-center text-[#e5e1e4]"
            >
              <span className="material-symbols-outlined text-[20px]">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0e0e10]/95 backdrop-blur-2xl border-b border-[#3c4a42]/30 px-6 py-4 flex flex-col gap-3 font-mono text-sm animate-fadeIn">
            <a href="#capabilities" onClick={() => setMobileMenuOpen(false)} className="text-[#bbcabf] hover:text-[#4edea3] py-1">Features</a>
            <a href="#comparison" onClick={() => setMobileMenuOpen(false)} className="text-[#bbcabf] hover:text-[#4edea3] py-1">Comparison</a>
            <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="text-[#bbcabf] hover:text-[#4edea3] py-1">Architecture</a>
            <button onClick={() => { setMobileMenuOpen(false); onNavigateToConsole(); }} className="text-[#4edea3] text-left py-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">dashboard</span> Console Dashboard
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full pt-16">
        <div className="flex flex-col w-full">
          {/* Top Ambient Glow Field with Dynamic 3D Planet */}
          <div className="relative w-full overflow-hidden">
            {/* 3D Global Edge Mesh Visualization Layer */}
            <div className="absolute inset-0 w-full h-[850px] pointer-events-none z-0 overflow-hidden flex items-center justify-center">
              <ThreeGlobeMesh />
            </div>

            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#4edea3]/20 via-[#4cd7f6]/15 to-transparent blur-3xl pointer-events-none rounded-full animate-ambient-drift" />
            <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-[#4cd7f6]/10 blur-[120px] pointer-events-none rounded-full" />

            {/* 1. HERO SECTION */}
            <section className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 pt-10 pb-12 flex flex-col items-center text-center relative z-10">

              {/* Pulsing Live Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#162720]/80 border border-[#4edea3]/30 text-xs font-mono text-[#4edea3] mb-6 backdrop-blur-md shadow-[0_0_15px_rgba(78,222,163,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
                </span>
                <span>Zero-Downtime Microservice Platform</span>
              </div>


              {/* Main Headline */}
              <h1 className="text-3xl md:text-5xl lg:text-[54px] lg:leading-[62px] text-[#e5e1e4] max-w-4xl tracking-tight mb-4 font-semibold">
                Deploy at the speed of thought.
                <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4edea3] via-[#4cd7f6] to-[#6ffbbe] drop-shadow-[0_0_24px_rgba(78,222,163,0.3)]">
                  {' '}Scale to billions.
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="text-sm md:text-lg text-[#bbcabf] max-w-2xl mb-8 leading-relaxed">
                CloudScale is the developer-first cloud platform that turns your Git repos into globally distributed,
                zero-downtime microservices, containers, and databases in seconds.
              </p>

              {/* CTA Buttons Row */}
              <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-xl mb-12">
                <button
                  onClick={onNavigateToConsole}
                  className="animate-shimmer flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-[#4edea3] text-[#003824] font-semibold text-sm hover:bg-[#6ffbbe] transition-all shadow-[0_0_20px_rgba(78,222,163,0.35)] active:scale-95 duration-150"
                >
                  <span>Start Deploying Free</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>

                {/* Interactive Terminal Copy Button */}
                <button
                  onClick={handleCopyNpx}
                  className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#2a2a2c]/90 backdrop-blur-md border border-[#3c4a42]/40 hover:border-[#4edea3]/50 hover:bg-[#39393b] text-[#e5e1e4] font-mono text-xs transition-all group shadow-sm active:scale-95 duration-150 cursor-pointer"
                >
                  <span className="text-[#4cd7f6] select-none font-semibold">&gt;_</span>
                  <span className={copyState === 'copied' ? 'text-[#4edea3] font-semibold' : ''}>
                    {copyState === 'copied' ? 'Copied to clipboard!' : 'npx cloudscale init'}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-[#bbcabf] group-hover:text-[#4edea3] transition-colors">
                    {copyState === 'copied' ? 'check' : 'content_copy'}
                  </span>
                </button>

              </div>


            </section>
          </div>

          {/* 2. INTERACTIVE ARCHITECTURE PREVIEW */}
          <section id="topology" className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 w-full pb-14 relative z-10">
            <div className="spotlight-card grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#0e0e10]/85 backdrop-blur-xl border border-[#4edea3]/20 rounded-xl p-3 md:p-4 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#4edea3]/40 to-transparent pointer-events-none" />

              {/* Left Pane: Code & CLI Workflow (7 cols) */}
              <div className="lg:col-span-7 flex flex-col bg-[#201f22]/90 backdrop-blur-md rounded-lg overflow-hidden shadow-inner border border-[#3c4a42]/30">
                {/* Terminal Tab Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#1c1b1d]/90 border-b border-[#3c4a42]/20">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ffb4ab]/80" />
                    <span className="w-3 h-3 rounded-full bg-[#03b5d3]/80" />
                    <span className="w-3 h-3 rounded-full bg-[#4edea3]/80" />
                    <span className="ml-2 font-mono text-xs text-[#86948a]">
                      {activeTab === 'git'
                        ? 'edge-cluster-main — bash'
                        : activeTab === 'config'
                        ? 'cloudscale.config.ts — typescript'
                        : 'Dockerfile — oci builder'}
                    </span>
                  </div>
                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-[#0e0e10]/80 p-0.5 rounded-lg border border-[#3c4a42]/30">
                    <button
                      onClick={() => setActiveTab('git')}
                      className={`px-2 py-0.5 rounded font-mono text-xs transition-all ${
                        activeTab === 'git'
                          ? 'bg-[#353437] text-[#4edea3] font-medium shadow-sm'
                          : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                      }`}
                    >
                      git push
                    </button>
                    <button
                      onClick={() => setActiveTab('config')}
                      className={`px-2 py-0.5 rounded font-mono text-xs transition-all ${
                        activeTab === 'config'
                          ? 'bg-[#353437] text-[#4edea3] font-medium shadow-sm'
                          : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                      }`}
                    >
                      config.ts
                    </button>
                    <button
                      onClick={() => setActiveTab('docker')}
                      className={`px-2 py-0.5 rounded font-mono text-xs transition-all ${
                        activeTab === 'docker'
                          ? 'bg-[#353437] text-[#4edea3] font-medium shadow-sm'
                          : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                      }`}
                    >
                      Dockerfile
                    </button>
                  </div>
                </div>

                {/* Terminal Body */}
                <div className="p-4 md:p-5 font-mono text-xs flex flex-col gap-2 bg-[#0e0e10] overflow-x-auto min-h-[340px]">
                  {activeTab === 'git' && (
                    <>
                      <div className="flex items-center gap-2 text-[#86948a]">
                        <span className="text-[#4cd7f6] font-semibold">$</span>
                        <span className="text-[#e5e1e4]">POST /api/deploy</span>
                      </div>
                      <div className="text-[#bbcabf] pl-4">{"{"} repoUrl: 'https://github.com/example/app' {"}"}</div>
                      <div className="text-[#4cd7f6] pl-4 flex items-center gap-2 mt-2">
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        <span>[x7j2k] Initializing deployment for https://github.com/example/app...</span>
                      </div>
                      <div className="text-[#4edea3] pl-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>[x7j2k] Cloning repository into .deployments/x7j2k...</span>
                      </div>
                      <div className="text-[#4edea3] pl-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>[x7j2k] Running npm install...</span>
                      </div>
                      <div className="text-[#4edea3] pl-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>[x7j2k] npm install completed. Starting application on port 4001...</span>
                      </div>
                      <div className="mt-2 p-2.5 rounded bg-[#1c1b1d] border border-[#4edea3]/20 flex flex-col gap-1 shadow-sm">
                        <div className="flex items-center justify-between text-[#e5e1e4] font-medium">
                          <span className="flex items-center gap-1.5 text-[#4edea3] font-semibold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]" />
                            </span>
                            DEPLOYMENT ACTIVE
                          </span>
                        </div>
                        <button
                          onClick={onNavigateToConsole}
                          className="text-[#4cd7f6] hover:underline cursor-pointer flex items-center gap-1 text-left"
                        >
                          <span className="material-symbols-outlined text-[14px]">link</span>
                          <span>http://x7j2k.localhost:8000</span>
                        </button>
                      </div>
                    </>
                  )}

                  {activeTab === 'config' && (
                    <div className="flex flex-col gap-1 text-[#e5e1e4]">
                      <div className="text-[#86948a]">// cloudscale.config.ts</div>
                      <div>
                        <span className="text-[#4cd7f6]">import</span> &#123; defineConfig &#125;{' '}
                        <span className="text-[#4cd7f6]">from</span>{' '}
                        <span className="text-[#4edea3]">'@cloudscale/runtime'</span>;
                      </div>
                      <div className="mt-1">
                        <span className="text-[#4cd7f6]">export default</span> defineConfig(&#123;
                      </div>
                      <div className="pl-4 text-[#bbcabf]">
                        project: <span className="text-[#4edea3]">'api-gateway'</span>,
                      </div>
                      <div className="pl-4 text-[#bbcabf]">
                        runtime: <span className="text-[#4edea3]">'microvm-v2'</span>,
                      </div>
                      <div className="pl-4 text-[#bbcabf]">
                        regions: [<span className="text-[#d0bcff]">'sfo'</span>,{' '}
                        <span className="text-[#d0bcff]">'fra'</span>,{' '}
                        <span className="text-[#d0bcff]">'sin'</span>,{' '}
                        <span className="text-[#d0bcff]">'iad'</span>],
                      </div>
                      <div className="pl-4 text-[#bbcabf]">scaling: &#123;</div>
                      <div className="pl-8 text-[#bbcabf]">
                        minReplicas: <span className="text-[#4cd7f6]">0</span>,{' '}
                        <span className="text-[#86948a]">// scale to zero on idle</span>
                      </div>
                      <div className="pl-8 text-[#bbcabf]">
                        maxReplicas: <span className="text-[#4cd7f6]">5000</span>,
                      </div>
                      <div className="pl-8 text-[#bbcabf]">
                        concurrency: <span className="text-[#4cd7f6]">1000</span>
                      </div>
                      <div className="pl-4 text-[#bbcabf]">&#125;,</div>
                      <div className="pl-4 text-[#bbcabf]">
                        edgeKV: &#123; replication: <span className="text-[#4edea3]">'multi-master-sync'</span> &#125;
                      </div>
                      <div>&#125;);</div>
                      <div className="text-[#86948a] mt-3 pl-2 flex items-center gap-2">
                        <span className="text-[#4edea3]">✓</span>
                        <span>Validated schema v2.4 in 12ms</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'docker' && (
                    <div className="flex flex-col gap-1 text-[#e5e1e4]">
                      <div className="text-[#86948a]"># Multi-stage Firecracker Layer Optimizer</div>
                      <div>
                        <span className="text-[#4cd7f6]">FROM</span> node:22-alpine{' '}
                        <span className="text-[#4cd7f6]">AS</span> base
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">WORKDIR</span> /app
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">COPY</span> package.json pnpm-lock.yaml ./
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">RUN</span> corepack enable &amp;&amp; pnpm install
                        --frozen-lockfile
                      </div>
                      <div className="mt-1">
                        <span className="text-[#4cd7f6]">FROM</span> base <span className="text-[#4cd7f6]">AS</span>{' '}
                        builder
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">COPY</span> . .
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">RUN</span> pnpm build
                      </div>
                      <div className="mt-1">
                        <span className="text-[#4cd7f6]">FROM</span> gcr.io/distroless/nodejs22-debian12
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">COPY</span> --from=builder /app/dist ./dist
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">EXPOSE</span> 8080
                      </div>
                      <div>
                        <span className="text-[#4cd7f6]">CMD</span> [
                        <span className="text-[#4edea3]">"dist/server.js"</span>]
                      </div>
                      <div className="text-[#4edea3] mt-2 pl-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>OCI base size: 34.2 MB (Cached)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Local Infrastructure Visualizer (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between bg-[#201f22]/90 backdrop-blur-md rounded-lg p-4 shadow-inner relative overflow-hidden border border-[#3c4a42]/30">
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#4cd7f6]/15 rounded-full blur-3xl pointer-events-none" />
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 mb-3 bg-[#1c1b1d]/60 p-2.5 rounded border border-[#3c4a42]/20">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]" />
                      </span>
                      <span className="text-[11px] font-semibold text-[#e5e1e4] tracking-wider uppercase">
                        LOCAL INFRASTRUCTURE
                      </span>
                    </div>
                  </div>

                  {/* Node Status List */}
                  <div className="flex flex-col gap-1.5 mb-4">
                    <div className="group flex items-center justify-between p-2.5 rounded bg-[#0e0e10]/80 hover:bg-[#2a2a2c]/90 border border-transparent hover:border-[#4edea3]/30 transition-all duration-200">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px] group-hover:scale-110 transition-transform">
                          router
                        </span>
                        <div>
                          <div className="font-mono text-xs text-[#e5e1e4] font-medium">Express Reverse Proxy</div>
                          <div className="text-[11px] text-[#86948a]">Routing dynamic subdomains</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs text-[#4edea3] font-semibold">Port 8000</span>
                      </div>
                    </div>

                    <div className="group flex items-center justify-between p-2.5 rounded bg-[#0e0e10]/80 hover:bg-[#2a2a2c]/90 border border-transparent hover:border-[#4edea3]/30 transition-all duration-200">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px] group-hover:scale-110 transition-transform">
                          database
                        </span>
                        <div>
                          <div className="font-mono text-xs text-[#e5e1e4] font-medium">SQLite Persistence</div>
                          <div className="text-[11px] text-[#86948a]">deployments.db • better-sqlite3</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs text-[#4edea3] font-semibold">Active</span>
                      </div>
                    </div>

                    <div className="group flex items-center justify-between p-2.5 rounded bg-[#0e0e10]/80 hover:bg-[#2a2a2c]/90 border border-transparent hover:border-[#4edea3]/30 transition-all duration-200">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px] group-hover:scale-110 transition-transform">
                          lock
                        </span>
                        <div>
                          <div className="font-mono text-xs text-[#e5e1e4] font-medium">Clerk Authentication</div>
                          <div className="text-[11px] text-[#86948a]">Protecting Console & API</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs text-[#4edea3] font-semibold">Enabled</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telemetry Numbers Ticker */}
                <div className="grid grid-cols-3 gap-2 pt-2 bg-[#0e0e10]/90 border border-[#3c4a42]/20 p-2.5 rounded">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#86948a]">OPEN SOURCE</span>
                    <span className="font-mono text-sm text-[#4edea3] font-bold">100%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#86948a]">HOSTING</span>
                    <span className="font-mono text-sm text-[#4cd7f6] font-bold">Self-hosted</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#86948a]">PRICING</span>
                    <span className="font-mono text-sm text-[#4edea3] font-bold">Free</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. BENTO GRID CAPABILITIES */}
          <section id="capabilities" className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 w-full pb-14">
            <div className="flex flex-col items-start mb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4edea3]">
                  Core Capabilities
                </span>
              </div>
              <h2 className="text-2xl font-semibold text-[#e5e1e4]">Built with a modern local stack.</h2>
              <p className="text-sm text-[#bbcabf] max-w-xl">
                Everything you need to clone, run, and route traffic to Node.js applications locally.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1 (2 cols): Git to local deployment */}
              <div className="lg:col-span-2 spotlight-card bg-[#201f22]/85 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between group relative overflow-hidden">
                <div className="flex flex-col gap-2 mb-6 z-10">
                  <div className="w-10 h-10 rounded bg-[#4edea3]/10 border border-[#4edea3]/20 flex items-center justify-center text-[#4edea3] mb-1 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">rocket_launch</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4]">Local Node.js Deployments</h3>
                  <p className="text-sm text-[#bbcabf] max-w-lg">
                    Automatically clones your GitHub repository, installs dependencies via NPM, and starts your application on an isolated local port.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0e0e10]/90 backdrop-blur-sm border border-[#3c4a42]/30 flex flex-col gap-2 font-mono text-xs z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#86948a]">
                      <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">account_tree</span>
                      <span>feat(auth): add OAuth2 passkeys support</span>
                    </div>
                    <span className="px-2 py-0.5 rounded border border-[#4edea3]/30 bg-[#4edea3]/10 text-[#4edea3]">
                      PORT 8001
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#86948a] border-t border-[#3c4a42]/20 pt-2">
                    <span>Local URL: <span className="text-[#4cd7f6]">http://x7j2k.localhost:8000</span></span>
                    <button className="flex items-center gap-1 hover:text-[#e5e1e4] transition-colors cursor-pointer bg-[#2a2a2c] px-2 py-1 rounded border border-[#3c4a42]/40">
                      <span className="material-symbols-outlined text-[14px]">history</span> Redeploy
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Subdomains */}
              <div className="spotlight-card bg-[#201f22]/85 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between group">
                <div className="flex flex-col gap-2 mb-6">
                  <div className="w-10 h-10 rounded bg-[#4cd7f6]/10 border border-[#4cd7f6]/20 flex items-center justify-center text-[#4cd7f6] mb-1 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">route</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4]">Dynamic Subdomain Routing</h3>
                  <p className="text-sm text-[#bbcabf]">
                    Leverages http-proxy to dynamically route requests from *.localhost:8000 to your application's unique local port.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0e0e10]/90 backdrop-blur-sm border border-[#3c4a42]/30 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center font-mono text-xs text-[#e5e1e4]">
                    <span className="text-[#86948a] font-medium">Proxy Traffic:</span>
                    <span className="text-[#4edea3] font-bold px-1.5 py-0.5 rounded bg-[#4edea3]/10 border border-[#4edea3]/20">
                      Active
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#2a2a2c] rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-gradient-to-r from-[#4cd7f6] to-[#4edea3] rounded-full transition-all duration-150 w-full" />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#86948a] mt-1">
                    <span>Host: api.localhost:8000</span>
                    <span className="text-[#4cd7f6] font-mono">-&gt; :4001</span>
                  </div>
                </div>
              </div>

              {/* Card 3: SQLite */}
              <div className="spotlight-card bg-[#201f22]/85 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between group">
                <div className="flex flex-col gap-2 mb-6">
                  <div className="w-10 h-10 rounded bg-[#d0bcff]/10 border border-[#d0bcff]/20 flex items-center justify-center text-[#d0bcff] mb-1 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">database</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4]">Local SQLite Persistence</h3>
                  <p className="text-sm text-[#bbcabf]">
                    Fast, reliable local storage using better-sqlite3 to persist your active deployments and application metadata.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0e0e10]/90 backdrop-blur-sm border border-[#3c4a42]/30 font-mono text-xs flex flex-col gap-1 text-[#86948a]">
                  <div className="flex items-center justify-between text-[#e5e1e4]">
                    <span>db.prepare("SELECT *")</span>
                    <span className="text-[#4edea3] font-semibold">&lt; 1.2ms</span>
                  </div>
                  <div className="flex items-center justify-between text-[#e5e1e4]">
                    <span>db.exec("INSERT...")</span>
                    <span className="text-[#4cd7f6] font-semibold">Success</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Clerk */}
              <div className="spotlight-card bg-[#201f22]/85 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between group">
                <div className="flex flex-col gap-2 mb-6">
                  <div className="w-10 h-10 rounded bg-[#4edea3]/10 border border-[#4edea3]/20 flex items-center justify-center text-[#4edea3] mb-1 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">verified_user</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4]">Clerk Authentication</h3>
                  <p className="text-sm text-[#bbcabf]">
                    Secure your platform with industry-standard authentication. Protects both the React dashboard and the Express API.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0e0e10]/90 backdrop-blur-sm border border-[#3c4a42]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[20px]">lock</span>
                    <span className="font-mono text-xs text-[#e5e1e4]">requireAuth()</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#2a2a2c] border border-[#3c4a42]/30 text-[#86948a]">
                    Secured
                  </span>
                </div>
              </div>

              {/* Card 5: Streaming Observability */}
              <div className="spotlight-card bg-[#201f22]/85 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between group">
                <div className="flex flex-col gap-2 mb-6">
                  <div className="w-10 h-10 rounded bg-[#4cd7f6]/10 border border-[#4cd7f6]/20 flex items-center justify-center text-[#4cd7f6] mb-1 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">terminal</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4]">Live Log Streaming</h3>
                  <p className="text-sm text-[#bbcabf]">
                    Watch your build process and runtime logs in real-time, streamed directly from the local node process to the dashboard.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0e0e10]/90 backdrop-blur-sm border border-[#3c4a42]/30 flex flex-col gap-1.5 group/chart">
                  <div className="flex justify-between items-center text-[#86948a] font-mono text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-ping" />
                      STDOUT / STDERR
                    </span>
                    <span className="text-[#4edea3] font-bold">Streaming</span>
                  </div>
                  <div className="w-full h-8 mt-1 flex flex-col gap-1 text-[9px] font-mono text-[#86948a]">
                    <div>&gt; npm run start</div>
                    <div className="text-[#e5e1e4]">&gt; Server listening on port 4001</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. COMPARISON MATRIX */}
          <section id="comparison" className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 w-full pb-14">
            <div className="spotlight-card bg-[#201f22]/85 backdrop-blur-xl rounded-xl p-6 md:p-8 shadow-lg border border-white/10 relative overflow-hidden">
              <div className="flex flex-col items-start mb-6 max-w-3xl">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4cd7f6] mb-1">
                  The Local Development Shift
                </span>
                <h2 className="text-2xl font-semibold text-[#e5e1e4] mb-1">
                  Why developers choose CloudScale over raw localhost.
                </h2>
                <p className="text-sm text-[#bbcabf]">
                  No complex docker-compose setups, no manual port hunting, and no tedious reverse proxy configurations. Pure developer ergonomics.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-[#1c1b1d]/80 text-[#e5e1e4] text-[11px] font-semibold uppercase tracking-wider border-b border-[#3c4a42]/30">
                      <th className="py-3 px-4 rounded-l">Metric / Feature</th>
                      <th className="py-3 px-4 text-[#4edea3] font-bold">CloudScale Local</th>
                      <th className="py-3 px-4 text-[#86948a]">Manual Docker & Nginx</th>
                      <th className="py-3 px-4 text-[#86948a] rounded-r">Local Kubernetes (Minikube)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-[#2a2a2c]/80 hover:shadow-[inset_4px_0_0_0_#4edea3] transition-all">
                      <td className="py-3 px-4 font-medium text-[#e5e1e4]">Time to First Deploy</td>
                      <td className="py-3 px-4 font-mono text-[#4edea3] font-bold">30 seconds</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">15 minutes (Writing configs)</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">1-2 hours setup</td>
                    </tr>
                    <tr className="hover:bg-[#2a2a2c]/80 hover:shadow-[inset_4px_0_0_0_#4edea3] transition-all bg-[#1c1b1d]/40">
                      <td className="py-3 px-4 font-medium text-[#e5e1e4]">Configuration Overhead</td>
                      <td className="py-3 px-4 font-mono text-[#4edea3] font-bold">Zero config</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">Writing Nginx & Dockerfiles</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">Complex YAML Manifests</td>
                    </tr>
                    <tr className="hover:bg-[#2a2a2c]/80 hover:shadow-[inset_4px_0_0_0_#4edea3] transition-all">
                      <td className="py-3 px-4 font-medium text-[#e5e1e4]">Subdomain Routing</td>
                      <td className="py-3 px-4 font-mono text-[#4edea3] font-bold">Automatic (*.localhost)</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">Manual /etc/hosts edits</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">Complex Ingress Controllers</td>
                    </tr>
                    <tr className="hover:bg-[#2a2a2c]/80 hover:shadow-[inset_4px_0_0_0_#4edea3] transition-all bg-[#1c1b1d]/40">
                      <td className="py-3 px-4 font-medium text-[#e5e1e4]">Data Persistence</td>
                      <td className="py-3 px-4 font-mono text-[#4edea3] font-bold">Built-in SQLite</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">Manual volume mapping</td>
                      <td className="py-3 px-4 font-mono text-[#86948a]">PersistentVolumeClaims</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 5. DEVELOPER DASHBOARD */}
          <section id="architecture" className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 w-full pb-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left description */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4cd7f6]">
                    Developer Console
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-[#e5e1e4] leading-tight">
                  One click.
                  <br />
                  Full local topology.
                </h2>
                <p className="text-sm text-[#bbcabf] leading-relaxed">
                  CloudScale provides a beautiful React dashboard to deploy, manage, and monitor your local Node.js microservices with a single click.
                </p>
                <div className="flex flex-col gap-2 pt-1 font-mono text-xs">
                  <button
                    onClick={onNavigateToConsole}
                    className="flex items-center gap-2 text-[#e5e1e4] group cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">terminal</span>
                    <span className="group-hover:text-[#4edea3] transition-colors">
                      Open Console Dashboard
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-[#86948a] opacity-0 group-hover:opacity-100 transition-opacity">
                      arrow_forward
                    </span>
                  </button>
                  <div className="flex items-center gap-2 text-[#e5e1e4]">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">sync_alt</span>
                    <span>Automated local port assignment</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#e5e1e4]">
                    <span className="material-symbols-outlined text-[#d0bcff] text-[18px]">security</span>
                    <span>Secure Clerk identity management</span>
                  </div>
                </div>
              </div>

              {/* Right terminal visual */}
              <div className="lg:col-span-7">
                <div className="spotlight-card bg-[#0e0e10]/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-white/10">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#201f22]/90 border-b border-[#3c4a42]/30">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#ffb4ab]/80" />
                      <span className="w-3 h-3 rounded-full bg-[#03b5d3]/80" />
                      <span className="w-3 h-3 rounded-full bg-[#4edea3]/80" />
                      <span className="ml-2 font-mono text-xs text-[#bbcabf] font-medium">terminal — zsh</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#86948a]">local-runner</span>
                  </div>
                  <div className="p-5 font-mono text-xs flex flex-col gap-2 bg-[#0e0e10]/95">
                    <div className="flex items-center gap-2">
                      <span className="text-[#4cd7f6] font-bold">&gt;</span>
                      <span className="text-[#e5e1e4] font-semibold">cloudscale start dashboard</span>
                    </div>
                    <div className="text-[#bbcabf] pl-4">
                      Vite dev server running on port 3000
                    </div>
                    <div className="text-[#4edea3] pl-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Connected to deployments.db</span>
                    </div>
                    <div className="text-[#4edea3] pl-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Reverse proxy active on port 8000</span>
                    </div>
                    <div className="text-[#4edea3] pl-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Clerk Auth middleware loaded</span>
                    </div>
                    <div className="mt-2 p-2.5 rounded bg-[#1c1b1d] border border-[#4edea3]/20 flex flex-col gap-1 pl-4 shadow-sm">
                      <div className="text-[#4edea3] font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        <span>Local Platform Ready</span>
                      </div>
                      <div className="text-[#86948a] font-mono text-[11px]">
                        Dashboard URL: <span className="text-[#4cd7f6]">http://localhost:3000/#console</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. BOTTOM CTA */}
          <section className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 w-full pb-14">
            <div className="spotlight-card relative overflow-hidden rounded-xl bg-gradient-to-b from-[#201f22]/90 via-[#201f22]/90 to-[#1c1b1d]/90 backdrop-blur-xl p-8 md:p-12 text-center flex flex-col items-center justify-center shadow-2xl border border-white/10">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#4edea3]/50 to-transparent pointer-events-none" />
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-[#4edea3]/20 blur-3xl rounded-full pointer-events-none animate-pulse" />

              <div className="relative z-10 flex flex-col items-center max-w-2xl">
                <span className="relative flex h-3 w-3 mb-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4edea3] shadow-[0_0_12px_rgba(78,222,163,0.8)]" />
                </span>
                <h2 className="text-2xl md:text-3xl text-[#e5e1e4] font-semibold mb-2 tracking-tight">
                  Ready to host your own platform?
                </h2>
                <p className="text-sm md:text-base text-[#bbcabf] mb-6">
                  Spin up your first local microservice cluster. 100% Free and Open Source. Up and running in under a minute.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={onNavigateToConsole}
                    className="animate-shimmer flex items-center gap-2 px-6 py-2.5 rounded bg-[#4edea3] text-[#003824] font-semibold text-sm hover:bg-[#6ffbbe] transition-all shadow-[0_0_20px_rgba(78,222,163,0.4)] active:scale-95 duration-150"
                  >
                    <span>Open Developer Console</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-6 py-2.5 rounded bg-[#2a2a2c]/90 backdrop-blur-md hover:bg-[#39393b] border border-[#3c4a42]/40 text-[#e5e1e4] text-sm transition-all active:scale-95 duration-150"
                  >
                    <span>View on GitHub</span>
                  </a>
                </div>
                <p className="font-mono text-[11px] text-[#86948a] mt-6">
                  MIT Licensed • 100% Local Execution • Built with React & Express
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#0e0e10] py-12 border-t border-[#3c4a42]/30">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CloudScaleLogo className="h-6 w-auto object-contain" />
                <span className="text-base font-semibold text-[#e5e1e4]">CloudScale Local</span>
              </div>
              <p className="text-xs text-[#bbcabf] leading-relaxed max-w-sm">
                The local development substrate for cloning, running, and routing Node.js applications. A powerful self-hosted PaaS alternative.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold text-[#bbcabf] uppercase">Features</h4>
              <div className="flex flex-col gap-1 text-xs text-[#bbcabf]">
                <a href="#capabilities" className="hover:text-[#e5e1e4] transition-colors">Local Deployments</a>
                <a href="#capabilities" className="hover:text-[#e5e1e4] transition-colors">Dynamic Routing</a>
                <a href="#capabilities" className="hover:text-[#e5e1e4] transition-colors">SQLite Storage</a>
                <a href="#capabilities" className="hover:text-[#e5e1e4] transition-colors">Clerk Authentication</a>
                <a href="#capabilities" className="hover:text-[#e5e1e4] transition-colors">Log Streaming</a>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold text-[#bbcabf] uppercase">Resources</h4>
              <div className="flex flex-col gap-1 text-xs text-[#bbcabf]">
                <button onClick={onNavigateToConsole} className="text-left hover:text-[#e5e1e4] transition-colors">Console Dashboard</button>
                <a href="https://github.com" className="hover:text-[#e5e1e4] transition-colors">GitHub Repository</a>
                <a href="https://github.com" className="hover:text-[#e5e1e4] transition-colors">Issue Tracker</a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#3c4a42]/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
              <button
                onClick={onNavigateToConsole}
                className="font-mono text-xs text-[#bbcabf] hover:text-[#4edea3] transition-colors"
              >
                All local systems operational
              </button>
            </div>
            <div className="text-xs text-[#bbcabf]">
              © {new Date().getFullYear()} CloudScale Local. Open Source Developer Infrastructure.
            </div>
            <div className="flex items-center gap-4 text-[#bbcabf] font-mono text-xs">
              <a href="https://github.com" className="hover:text-[#e5e1e4] transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

