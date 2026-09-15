import React, { useState, useRef, useEffect } from 'react';
import { ThreeMicroVmScene } from './ThreeMicroVmScene.tsx';
import { CloudScaleLogo } from './CloudScaleLogo.tsx';
import { ServiceWorkload, DomainItem, TerminalLog } from '../types.ts';
import { useAuth, UserButton, SignedIn, RedirectToSignIn } from '@clerk/clerk-react';

interface ConsoleDashboardProps {
  onNavigateToLanding: () => void;
}

export const ConsoleDashboard: React.FC<ConsoleDashboardProps> = ({ onNavigateToLanding }) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [services, setServices] = useState<ServiceWorkload[]>([]);
  const [filter, setFilter] = useState<'all' | 'http' | 'workers'>('all');
  const [activeNav, setActiveNav] = useState<string>('Overview');
  const [selectedVpc, setSelectedVpc] = useState<string>('prod-primary-vpc');
  const [deployRepoUrl, setDeployRepoUrl] = useState<string>('https://github.com/cloudscale-labs/api-gateway');
  const [deployBranch, setDeployBranch] = useState<string>('main');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [logFilter, setLogFilter] = useState<string>('');
  const [activeLogTab, setActiveLogTab] = useState<'build' | 'runtime' | 'access'>('build');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Replica scaling state
  const [targetServiceId, setTargetServiceId] = useState<string>('s1');
  const [replicaCount, setReplicaCount] = useState<number>(4);
  const [isScalingApplied, setIsScalingApplied] = useState<boolean>(false);

  const [showAddDomainModal, setShowAddDomainModal] = useState<boolean>(false);
  const [newDomainName, setNewDomainName] = useState<string>('');
  const [newDomainTarget, setNewDomainTarget] = useState<string>('');
  const [domains, setDomains] = useState<DomainItem[]>([]);

  // CNAME copy feedback
  const [cnameCopied, setCnameCopied] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch('/api/services', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Transform db format to UI format
          setServices(data.services.map((s: any) => ({
            id: s.id,
            name: s.repoUrl.split('/').pop()?.replace('.git', '') || s.id,
            kind: 'http',
            status: s.status === 'active' ? 'healthy' : s.status,
            environment: 'Production',
            region: 'local-edge',
            commitHash: 'latest',
            branch: 'main',
            replicas: 1,
            replicasSummary: '1 Replica',
            endpoint: `http://${s.id}.localhost:8000`,
            domains: [`${s.id}.localhost`],
            icon: 'rocket_launch',
            iconColor: 'text-[#4edea3]',
          })));
        }
      } catch (e) {
        console.error("Failed to fetch services", e);
      }
    };
    if (isSignedIn) {
      fetchServices();
    }
  }, [isSignedIn, getToken]);

  const handleSyncCluster = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const now = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => [
        ...prev,
        {
          timestamp: `${now}.104`,
          level: 'INFO',
          message: 'Cluster state verified: All 8 microVM nodes synchronized across AWS & GCP edge zones.',
        },
      ]);
    }, 900);
  };

  const handleDeploy = async () => {
    if (isDeploying) return;
    setIsDeploying(true);
    setLogs([]);

    try {
      const token = await getToken();
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repoUrl: deployRepoUrl })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Deploy failed');
      }

      // Poll for logs
      const interval = setInterval(async () => {
        try {
          const token = await getToken();
          const logRes = await fetch(`/api/logs/${data.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (logRes.ok) {
            const logData = await logRes.json();
            const newLogs = logData.logs.map((msg: string, i: number) => ({
              timestamp: new Date().toTimeString().split(' ')[0] + `.${String(i).padStart(3, '0')}`,
              level: msg.includes('Error') || msg.includes('failed') ? 'ERROR' : 'INFO',
              message: msg
            }));
            setLogs(newLogs);
            
            if (newLogs.some((l: any) => l.message.includes('Deployment active at') || l.message.includes('failed'))) {
              clearInterval(interval);
              setIsDeploying(false);
              
              if (newLogs.some((l: any) => l.message.includes('Deployment active at'))) {
                const newS: ServiceWorkload = {
                  id: data.id,
                  name: deployRepoUrl.split('/').pop()?.replace('.git', '') || data.id,
                  kind: 'http',
                  status: 'healthy',
                  environment: 'Production',
                  region: 'local-edge',
                  commitHash: 'latest',
                  branch: deployBranch,
                  replicas: 1,
                  replicasSummary: '1 Replica',
                  endpoint: data.url,
                  domains: [`${data.id}.localhost`],
                  icon: 'rocket_launch',
                  iconColor: 'text-[#4edea3]',
                };
                setServices((prev) => [newS, ...prev]);
              }
            }
          }
        } catch (e) {
          // ignore network errors while polling
        }
      }, 1000);

    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toTimeString().split(' ')[0],
          level: 'ERROR',
          message: `Deployment request failed: ${err.message}`,
        },
      ]);
      setIsDeploying(false);
    }
  };

  const handleApplyScaling = () => {
    setIsScalingApplied(true);
    setServices((prev) =>
      prev.map((s) =>
        s.id === targetServiceId
          ? {
              ...s,
              replicas: replicaCount,
              replicasSummary: `${replicaCount} Replicas`,
            }
          : s,
      ),
    );
    const now = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        timestamp: `${now}.230`,
        level: 'RUN',
        message: `Replica scaling applied: target=${
          services.find((s) => s.id === targetServiceId)?.name
        } count=${replicaCount} (${(replicaCount * 0.25).toFixed(1)} vCPU, ${replicaCount * 512} MB RAM)`,
      },
    ]);
    setTimeout(() => setIsScalingApplied(false), 1500);
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    const item: DomainItem = {
      id: `d_${Date.now()}`,
      domain: newDomainName.trim(),
      target: newDomainTarget,
      sslStatus: 'SSL Active',
      provider: "Let's Encrypt Wildcard • HTTP/3",
      autoRenew: true,
    };
    setDomains((prev) => [...prev, item]);
    setNewDomainName('');
    setShowAddDomainModal(false);
  };

  const filteredServices = services.filter((s) => {
    if (filter === 'http') return s.kind === 'http';
    if (filter === 'workers') return s.kind === 'workers';
    return true;
  }).filter((s) => {
    if (!globalSearch.trim()) return true;
    return s.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
           s.region.toLowerCase().includes(globalSearch.toLowerCase());
  });

  const filteredLogs = logs.filter((log) => {
    if (!logFilter) return true;
    return (
      log.message.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.level.toLowerCase().includes(logFilter.toLowerCase())
    );
  });

  const calculatedCost = (replicaCount * 9.625).toFixed(2);
  const vcpuValue = (replicaCount * 0.25).toFixed(1);
  const ramValue = replicaCount * 512;

  if (!isLoaded) return <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center text-[#4edea3] font-mono animate-pulse">Initializing Terminal...</div>;
  if (!isSignedIn) return <RedirectToSignIn />;

  return (
    <div className="bg-[#0e0e10] text-[#e5e1e4] min-h-screen flex flex-col font-sans selection:bg-[#10b981] selection:text-[#002113]">
      {/* Top Navbar */}
      <header className="flex justify-between items-center w-full px-4 lg:px-6 h-14 bg-[#131315]/90 backdrop-blur-md border-b border-[#3c4a42] sticky top-0 z-50 shadow-md shadow-black/40">
        <div className="flex items-center gap-6">
          {/* Left Brand Anchor */}
          <button
            onClick={onNavigateToLanding}
            className="flex items-center gap-2 group cursor-pointer text-left"
            title="Return to Public Landing Page"
          >
            <span className="w-6 h-6 rounded-lg bg-[#4edea3] flex items-center justify-center text-[#003824] font-mono text-xs font-bold shadow-sm shadow-[#4edea3]/30 group-hover:scale-105 transition-transform">
              ▲
            </span>
            <span className="text-lg font-semibold tracking-tight text-[#e5e1e4]">CloudScale</span>
          </button>

          {/* Primary Nav Links */}
          <nav className="hidden md:flex items-center gap-4">
            <button
              onClick={() => setActiveNav('Services & Deployments')}
              className="text-sm text-[#bbcabf] hover:text-[#e5e1e4] transition-colors"
            >
              Docs
            </button>
            <button
              onClick={() => alert('Support portal: Connected to 24/7 dedicated enterprise infrastructure team.')}
              className="text-sm text-[#bbcabf] hover:text-[#e5e1e4] transition-colors"
            >
              Support
            </button>
            <button
              onClick={() => alert('Changelog: v2.4.0 active with Anycast mesh routing and Firecracker v2.')}
              className="text-sm text-[#bbcabf] hover:text-[#e5e1e4] transition-colors"
            >
              Changelog
            </button>
            {/* Direct Switch to Landing Page */}
            <button
              onClick={onNavigateToLanding}
              className="text-xs px-2.5 py-1 rounded bg-[#201f22] border border-[#3c4a42] text-[#4edea3] hover:bg-[#2a2a2c] transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              <span>Landing Page</span>
            </button>
          </nav>
        </div>

        {/* Center / Right Search & Actions */}
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative hidden sm:flex items-center">
            <span className="material-symbols-outlined absolute left-2.5 text-[#86948a] text-[18px]">search</span>
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search resources, metrics..."
              className="bg-[#1c1b1d]/80 backdrop-blur-sm text-[#e5e1e4] pl-8 pr-12 py-1 font-mono text-xs rounded-lg border border-[#3c4a42] focus:outline-none focus:border-[#4cd7f6] focus:ring-1 focus:ring-[#4cd7f6] w-60 transition-all"
            />
            <kbd className="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono bg-[#2a2a2c] text-[#bbcabf] rounded border border-[#3c4a42]">
              Cmd+K
            </kbd>
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => alert('No active alerts. All 4 regions healthy.')}
              className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('deployment-logs-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
              title="Terminal Logs"
            >
              <span className="material-symbols-outlined text-[18px]">terminal</span>
            </button>
            <button
              onClick={() => alert('CloudScale Help: Docs, API specs, and CLI instructions available in sidebar.')}
              className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
              title="Help"
            >
              <span className="material-symbols-outlined text-[18px]">help</span>
            </button>
          </div>

          {/* Deploy Repository CTA */}
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="hidden lg:flex items-center gap-1.5 bg-[#4edea3] text-[#003824] text-xs font-semibold px-3 py-1.5 rounded hover:bg-[#6ffbbe] active:scale-95 transition-all shadow-sm shadow-[#4edea3]/20 btn-glow-primary"
          >
            <span className={`material-symbols-outlined text-[16px] ${isDeploying ? 'animate-spin' : ''}`}>
              {isDeploying ? 'progress_activity' : 'add'}
            </span>
            <span>{isDeploying ? 'Deploying...' : 'Deploy Repository'}</span>
          </button>

          {/* User Avatar */}
          <div className="relative ml-1 cursor-pointer flex items-center justify-center">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* App Shell Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-60 h-[calc(100vh-3.5rem)] flex-col justify-between py-4 px-3 bg-[#0e0e10]/95 backdrop-blur-md border-r border-[#3c4a42] shrink-0 sticky top-14 overflow-y-auto">
          <div className="space-y-4">
            {/* Project / VPC Selector */}
            <div className="relative">
              <select
                value={selectedVpc}
                onChange={(e) => setSelectedVpc(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#1c1b1d]/90 border border-[#3c4a42] hover:border-[#4edea3]/40 rounded-lg text-xs font-mono text-[#e5e1e4] appearance-none cursor-pointer focus:outline-none focus:border-[#4edea3]"
              >
                <option value="prod-primary-vpc">prod-primary-vpc (us-east-1)</option>
                <option value="staging-mesh-eu">staging-mesh-eu (eu-central-fra)</option>
                <option value="dev-sandbox-apac">dev-sandbox-apac (ap-se-sin)</option>
              </select>
              <span className="material-symbols-outlined text-[#bbcabf] text-[16px] absolute right-2.5 top-2 pointer-events-none">
                unfold_more
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1">
              {[
                { name: 'Overview', icon: 'dashboard' },
                { name: 'Services & Deployments', icon: 'rocket_launch' },
                { name: 'Logs & Metrics', icon: 'terminal' },
                { name: 'Replica Scaling', icon: 'tune' },
                { name: 'Subdomain Routing', icon: 'alt_route' },
                { name: 'Settings', icon: 'settings' },
              ].map((item) => {
                const isActive = activeNav === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => setActiveNav(item.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all text-left ${
                      isActive
                        ? 'text-[#4edea3] bg-[#1c1b1d]/90 border-l-2 border-[#4edea3] font-medium shadow-sm shadow-[#4edea3]/5'
                        : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#1c1b1d]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-[#3c4a42] space-y-1">
            <button
              onClick={() => alert('CloudScale Documentation v2.4')}
              className="w-full flex items-center gap-3 px-3 py-2 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#1c1b1d] text-xs rounded-lg transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Documentation</span>
            </button>
            <button
              onClick={() => alert('All edge PoPs operational (SLA: 99.999%).')}
              className="w-full flex items-center justify-between px-3 py-2 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#1c1b1d] text-xs rounded-lg transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px]">signal_cellular_alt</span>
                <span>System Status</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse-glow" />
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 overflow-y-auto bg-[#0e0e10] px-4 lg:px-8 py-6 max-w-[1440px] mx-auto w-full">
          {/* Sub-Header Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#3c4a42]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl text-[#e5e1e4] font-semibold tracking-tight">Production Cluster Overview</h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#2a2a2c]/80 text-[#4edea3] border border-[#4edea3]/30 flex items-center gap-1.5 shadow-sm shadow-[#4edea3]/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse-glow" />
                  99.99% Uptime
                </span>
              </div>
              <p className="text-xs text-[#bbcabf] mt-0.5">
                Automated high-availability deployment zone connected to AWS us-east-1 Edge ({selectedVpc}).
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncCluster}
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs bg-[#1c1b1d] border border-[#3c4a42] hover:border-[#86948a] hover:bg-[#2a2a2c] rounded text-[#e5e1e4] font-medium flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>{isSyncing ? 'Syncing...' : 'Sync Cluster'}</span>
              </button>
              <button
                onClick={() => {
                  const name = prompt('Enter new service name:', 'micro-worker');
                  if (name) {
                    const newS: ServiceWorkload = {
                      id: `s_${Date.now()}`,
                      name: name.toLowerCase().replace(/\s+/g, '-'),
                      kind: 'http',
                      status: 'healthy',
                      environment: 'Production',
                      region: 'us-east-1',
                      commitHash: 'b4109c',
                      branch: 'main',
                      replicas: 2,
                      replicasSummary: '2 Replicas',
                      endpoint: `https://${name.toLowerCase()}.cloudscale.io`,
                      domains: [`${name.toLowerCase()}.cloudscale.io`],
                      icon: 'bolt',
                      iconColor: 'text-[#4edea3]',
                    };
                    setServices((prev) => [...prev, newS]);
                  }
                }}
                className="px-3 py-1.5 text-xs bg-[#4edea3] text-[#003824] font-medium rounded hover:bg-[#6ffbbe] transition-all flex items-center gap-1.5 shadow-sm shadow-[#4edea3]/20 btn-glow-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>New Service</span>
              </button>
            </div>
          </div>

          {/* 3D Holographic MicroVM & Topology Card */}
          <section className="mt-6 rounded-xl bg-gradient-to-r from-[#131315] via-[#1c1b1d]/90 to-[#131315] border border-[#4edea3]/25 shadow-2xl shadow-black/70 backdrop-blur-md relative overflow-hidden tilt-card">
            <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-b from-[#4edea3]/15 via-[#4cd7f6]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-72 h-40 bg-[#4cd7f6]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-5 flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* Left Side: Telemetry Info */}
              <div className="flex-1 space-y-3 w-full lg:max-w-md">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold tracking-wider bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] flex items-center gap-1.5 shadow-sm shadow-[#4edea3]/20">
                    <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse-glow" />
                    3D CLUSTER TOPOLOGY (LIVE)
                  </span>
                  <span className="text-[11px] font-mono text-[#bbcabf] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#4cd7f6]">wifi_tethering</span>
                    Mesh Sync 12ms
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4] tracking-tight">
                    MicroVM Hypervisor Node Mesh
                  </h3>
                  <p className="text-xs text-[#bbcabf] mt-1 leading-relaxed">
                    Real-time WebGL representation of isolated Firecracker microVM shards, ingress quantum ring, and
                    cross-AZ telemetry packets.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-[#0e0e10]/80 border border-[#3c4a42]/70 backdrop-blur-sm">
                    <div className="text-[10px] text-[#bbcabf] font-mono">MESH NODES</div>
                    <div className="text-sm font-mono font-bold text-[#4edea3] mt-0.5">{services.length || 0} Active</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0e0e10]/80 border border-[#3c4a42]/70 backdrop-blur-sm">
                    <div className="text-[10px] text-[#bbcabf] font-mono">VM ISOLATION</div>
                    <div className="text-sm font-mono font-bold text-[#4cd7f6] mt-0.5">KVM / Jail</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0e0e10]/80 border border-[#3c4a42]/70 backdrop-blur-sm">
                    <div className="text-[10px] text-[#bbcabf] font-mono">BOOT TIME</div>
                    <div className="text-sm font-mono font-bold text-[#e5e1e4] mt-0.5">4.8 ms</div>
                  </div>
                </div>
              </div>

              {/* Right Side: 3D Scene */}
              <div className="w-full lg:flex-1 h-48 md:h-56 relative rounded-xl border border-[#3c4a42]/60 bg-[#0e0e10]/80 overflow-hidden flex items-center justify-center shadow-inner">
                <ThreeMicroVmScene />
                <div className="absolute bottom-2 right-3 pointer-events-none text-[10px] font-mono text-[#86948a] flex items-center gap-1.5 z-20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6] animate-ping" />
                  <span>PARALLAX CAMERA ACTIVE</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick GitHub Repository Deploy Hero Bar */}
          <section className="mt-6 p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] shadow-xl relative overflow-hidden tilt-card">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 relative z-10">
              <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#bbcabf]">
                    <span className="material-symbols-outlined text-[18px]">code_blocks</span>
                  </div>
                  <input
                    type="text"
                    value={deployRepoUrl}
                    onChange={(e) => setDeployRepoUrl(e.target.value)}
                    className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-[#e5e1e4] focus:outline-none focus:border-[#4cd7f6] focus:ring-1 focus:ring-[#4cd7f6] transition-all"
                    placeholder="https://github.com/username/repo-name"
                  />
                </div>

                <div className="relative min-w-[140px]">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#bbcabf]">
                    <span className="material-symbols-outlined text-[16px]">fork_right</span>
                  </div>
                  <select
                    value={deployBranch}
                    onChange={(e) => setDeployBranch(e.target.value)}
                    className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg pl-8 pr-8 py-2 text-xs font-mono text-[#e5e1e4] appearance-none focus:outline-none focus:border-[#4cd7f6] cursor-pointer"
                  >
                    <option value="main">main</option>
                    <option value="staging">staging</option>
                    <option value="feat/v2-preview">feat/v2-preview</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[#bbcabf]">
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1c1b1d] border border-[#3c4a42] text-xs font-mono text-[#4cd7f6] shrink-0">
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  <span>Next.js 14 detected</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="w-full lg:w-auto px-5 py-2 rounded-lg bg-[#4edea3] text-[#003824] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#6ffbbe] btn-glow-primary shadow-[0_0_20px_rgba(16,185,129,0.25)] active:scale-95 transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isDeploying ? 'animate-spin' : ''}`}>
                    {isDeploying ? 'progress_activity' : 'bolt'}
                  </span>
                  <span>{isDeploying ? 'Deploying...' : 'Deploy to Production'}</span>
                </button>
              </div>
            </div>
          </section>

          {/* Metrics & Environment Overview Strip */}
          <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Services */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4edea3]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>Total Services</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">dns</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">{services.length}</span>
                <span className="font-mono text-xs text-[#4edea3] flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse-glow" />
                  Active
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[#bbcabf] font-mono">0 Degraded · 0 Restarting</div>
            </div>

            {/* Global Edge Requests */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4cd7f6]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>Global Edge Requests</span>
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">public</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">{services.length * 15}K</span>
                <span className="font-mono text-xs text-[#4edea3] font-medium">+12.4%</span>
              </div>
              <div className="mt-1 text-[11px] text-[#bbcabf] font-mono">Trailing 24 hours · {services.length * 2} req/s</div>
            </div>

            {/* P99 Latency */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4edea3]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>P99 Latency</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">speed</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">38ms</span>
                <span className="font-mono text-xs text-[#4edea3] font-medium">-4.2ms</span>
              </div>
              <div className="mt-1 text-[11px] text-[#bbcabf] font-mono">Global edge POPs worldwide</div>
            </div>

            {/* Monthly Bandwidth */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#d0bcff]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>Monthly Bandwidth</span>
                <span className="material-symbols-outlined text-[#d0bcff] text-[18px]">cloud_sync</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">{(services.length * 1.5).toFixed(1)} GB</span>
                <span className="font-mono text-xs text-[#bbcabf]">/ 2 TB</span>
              </div>
              <div className="mt-2 w-full bg-[#2a2a2c] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#4edea3] h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (services.length * 1.5 / 2048) * 100)}%` }} />
              </div>
            </div>
          </section>

          {/* Active Workloads & Services */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg text-[#e5e1e4] font-semibold">Active Workloads &amp; Services</h2>
                <p className="text-xs text-[#bbcabf]">Production applications running on global container mesh.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#bbcabf]">Filter:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all active:scale-95 ${
                    filter === 'all'
                      ? 'bg-[#201f22] border border-[#4edea3]/30 text-[#4edea3]'
                      : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#201f22]/60'
                  }`}
                >
                  All ({services.length})
                </button>
                <button
                  onClick={() => setFilter('http')}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all active:scale-95 ${
                    filter === 'http'
                      ? 'bg-[#201f22] border border-[#4edea3]/30 text-[#4edea3]'
                      : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#201f22]/60'
                  }`}
                >
                  HTTP ({services.filter((s) => s.kind === 'http').length})
                </button>
                <button
                  onClick={() => setFilter('workers')}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all active:scale-95 ${
                    filter === 'workers'
                      ? 'bg-[#201f22] border border-[#4edea3]/30 text-[#4edea3]'
                      : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#201f22]/60'
                  }`}
                >
                  Workers ({services.filter((s) => s.kind === 'workers').length})
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#3c4a42] bg-[#131315]/90 backdrop-blur-md overflow-hidden divide-y divide-[#3c4a42] shadow-xl tilt-card">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#1c1b1d]/70 transition-colors"
                >
                  <div className="flex items-start md:items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#2a2a2c] border border-[#3c4a42] flex items-center justify-center shrink-0 shadow-sm shadow-[#4edea3]/10">
                      <span className={`material-symbols-outlined ${service.iconColor}`}>{service.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-[#e5e1e4]">{service.name}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse-glow" />
                          Healthy
                        </span>
                        <span className="text-xs text-[#bbcabf]">{service.environment}</span>
                        <span className="text-[#bbcabf]">•</span>
                        <span className="text-xs text-[#bbcabf]">{service.region}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 font-mono text-xs text-[#bbcabf] flex-wrap">
                        <span className="flex items-center gap-1 text-[#86948a]">
                          <span className="material-symbols-outlined text-[14px]">commit</span>
                          {service.branch}@{service.commitHash}
                        </span>
                        <span>•</span>
                        <span className="text-[#4cd7f6] font-medium">{service.replicasSummary}</span>
                        {service.endpoint && (
                          <>
                            <span>•</span>
                            <a
                              href={service.endpoint}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#bbcabf] hover:text-[#4cd7f6] flex items-center gap-1 underline underline-offset-2 transition-colors"
                            >
                              {service.endpoint.replace('https://', '')}
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => {
                        const el = document.getElementById('deployment-logs-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
                      title="View Logs"
                    >
                      <span className="material-symbols-outlined text-[18px]">terminal</span>
                    </button>
                    <button
                      onClick={() => {
                        setTargetServiceId(service.id);
                        setReplicaCount(service.replicas);
                        const el = document.getElementById('replica-scaling-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
                      title="Scale Replicas"
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                    <button
                      onClick={() => alert(`Settings for ${service.name}: All environment secrets and build args intact.`)}
                      className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
                      title="Settings"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2-Column Split: Replica Scaling & Subdomain Routing */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Replica Scaling & Allocation */}
            <section
              id="replica-scaling-section"
              className="p-5 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4edea3]/30 flex flex-col justify-between tilt-card shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#3c4a42]">
                  <div>
                    <h3 className="text-base text-[#e5e1e4] font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4edea3]">tune</span>
                      Replica Scaling &amp; Allocation
                    </h3>
                    <p className="text-xs text-[#bbcabf]">
                      Target workload:{' '}
                      <code className="text-[#4edea3] font-mono">
                        {services.find((s) => s.id === targetServiceId)?.name || 'api-gateway'}
                      </code>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#bbcabf] font-mono">ESTIMATED COST</div>
                    <div className="text-base font-mono font-bold text-[#4edea3]">
                      ${calculatedCost}
                      <span className="text-xs font-normal text-[#bbcabf]">/mo</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#e5e1e4] font-medium">Container Replicas</span>
                      <span className="font-mono text-[#4edea3] font-semibold">
                        {replicaCount} Active (Min 2 · Max 16)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="16"
                      value={replicaCount}
                      onChange={(e) => setReplicaCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#2a2a2c] rounded-lg appearance-none cursor-pointer accent-[#4edea3]"
                    />
                    <div className="flex justify-between text-[11px] font-mono text-[#bbcabf] mt-1">
                      <span>2 Replicas</span>
                      <span>8 Replicas</span>
                      <span>16 Replicas</span>
                    </div>
                  </div>

                  {/* CPU & Memory Specification Tiles */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-[#1c1b1d] border border-[#3c4a42] hover:border-[#4edea3]/30 rounded-lg transition-colors">
                      <div className="text-[#bbcabf] text-[11px] font-mono">CPU COMPUTE</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono text-base font-bold text-[#e5e1e4]">{vcpuValue} vCPU</span>
                        <span className="material-symbols-outlined text-[#86948a] text-[18px]">memory</span>
                      </div>
                      <div className="text-[11px] text-[#4edea3] font-mono mt-1">Burst up to 2.4 GHz</div>
                    </div>

                    <div className="p-3 bg-[#1c1b1d] border border-[#3c4a42] hover:border-[#4cd7f6]/30 rounded-lg transition-colors">
                      <div className="text-[#bbcabf] text-[11px] font-mono">DEDICATED RAM</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono text-base font-bold text-[#e5e1e4]">{ramValue} MB</span>
                        <span className="material-symbols-outlined text-[#86948a] text-[18px]">storage</span>
                      </div>
                      <div className="text-[11px] text-[#4cd7f6] font-mono mt-1">DDR5 ECC Cached</div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="p-3 bg-[#1c1b1d] border border-[#3c4a42] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4edea3] text-[18px]">verified</span>
                        <span className="text-xs text-[#e5e1e4] font-medium">Zero-Downtime Rolling Updates</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#4edea3] px-2 py-0.5 rounded bg-[#4edea3]/10 border border-[#4edea3]/20">
                        ENABLED
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">shield</span>
                        <span className="text-xs text-[#e5e1e4] font-medium">Cross-Zone Multi-Region Failover</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#4cd7f6] px-2 py-0.5 rounded bg-[#4cd7f6]/10 border border-[#4cd7f6]/20">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#3c4a42] flex items-center justify-end gap-2">
                <button
                  onClick={() => setReplicaCount(4)}
                  className="px-3 py-1.5 text-xs text-[#bbcabf] hover:text-[#e5e1e4] transition-colors active:scale-95"
                >
                  Reset
                </button>
                <button
                  onClick={handleApplyScaling}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#4edea3] text-[#003824] rounded hover:bg-[#6ffbbe] btn-glow-primary transition-all active:scale-95 shadow-sm shadow-[#4edea3]/20 flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isScalingApplied ? 'animate-spin' : ''}`}>
                    {isScalingApplied ? 'refresh' : 'check'}
                  </span>
                  <span>{isScalingApplied ? 'Applying...' : 'Apply Scaling Rules'}</span>
                </button>
              </div>
            </section>

            {/* Column 2: Custom Subdomain & SSL Routing */}
            <section
              id="subdomain-routing-section"
              className="p-5 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4cd7f6]/30 flex flex-col justify-between tilt-card shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#3c4a42]">
                  <div>
                    <h3 className="text-base text-[#e5e1e4] font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4cd7f6]">alt_route</span>
                      Domain &amp; SSL Routing
                    </h3>
                    <p className="text-xs text-[#bbcabf]">Edge ingress rules &amp; wildcard TLS termination.</p>
                  </div>
                  <button
                    onClick={() => setShowAddDomainModal(true)}
                    className="px-2.5 py-1 text-xs font-mono bg-[#2a2a2c] border border-[#3c4a42] rounded text-[#e5e1e4] hover:border-[#86948a] flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Add Domain
                  </button>
                </div>

                {/* Domain List */}
                <div className="mt-4 space-y-3">
                  {domains.map((dom) => (
                    <div
                      key={dom.id}
                      className="p-3 bg-[#1c1b1d] border border-[#3c4a42] hover:border-[#4edea3]/30 rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono text-xs font-semibold text-[#e5e1e4] flex items-center gap-2">
                            {dom.domain}
                            <span
                              className="material-symbols-outlined text-[#4edea3] text-[15px]"
                              title="DNS Verified"
                            >
                              check_circle
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-[#bbcabf] mt-0.5 flex items-center gap-1">
                            <span>Target:</span>
                            <span className="text-[#4cd7f6]">{dom.target}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#4edea3]/10 text-[#4edea3] border border-[#4edea3]/20">
                          {dom.sslStatus}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#3c4a42]/60 flex items-center justify-between text-[11px] font-mono text-[#86948a]">
                        <span>{dom.provider}</span>
                        <span className="text-[#4edea3] font-medium">Auto-renew ON</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline CNAME Guide */}
                <div className="mt-3 p-2.5 rounded bg-[#201f22] border border-[#3c4a42] text-[11px] font-mono text-[#bbcabf] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">info</span>
                    CNAME records point to: <code className="text-[#e5e1e4] font-semibold">cname.cloudscale.edge.net</code>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('cname.cloudscale.edge.net');
                      setCnameCopied(true);
                      setTimeout(() => setCnameCopied(false), 1500);
                    }}
                    className="text-[#4cd7f6] hover:underline cursor-pointer active:scale-95 transition-transform"
                  >
                    {cnameCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#3c4a42] flex items-center justify-between text-xs text-[#bbcabf]">
                <span>{domains.length} of 10 custom domains utilized</span>
                <button
                  onClick={() => alert('Routing Policies: CloudScale Anycast Geo-DNS directs requests to closest PoP within 10ms.')}
                  className="text-[#4cd7f6] hover:underline flex items-center gap-1 transition-colors"
                >
                  Routing policies
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </section>
          </div>

          {/* Live Deployment Logs Terminal Panel */}
          <section
            id="deployment-logs-section"
            className="mt-8 rounded-xl bg-[#0e0e10]/95 backdrop-blur-md border border-[#3c4a42] overflow-hidden shadow-2xl tilt-card"
          >
            <div className="px-4 py-2.5 bg-[#131315]/90 border-b border-[#3c4a42] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setActiveLogTab('build')}
                    className={`px-3 py-1 font-mono text-xs transition-colors ${
                      activeLogTab === 'build'
                        ? 'bg-[#1c1b1d] text-[#4edea3] border-b-2 border-[#4edea3] font-medium'
                        : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                    }`}
                  >
                    Build Logs
                  </button>
                  <button
                    onClick={() => setActiveLogTab('runtime')}
                    className={`px-3 py-1 font-mono text-xs transition-colors ${
                      activeLogTab === 'runtime'
                        ? 'bg-[#1c1b1d] text-[#4edea3] border-b-2 border-[#4edea3] font-medium'
                        : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                    }`}
                  >
                    Runtime Output
                  </button>
                  <button
                    onClick={() => setActiveLogTab('access')}
                    className={`px-3 py-1 font-mono text-xs transition-colors ${
                      activeLogTab === 'access'
                        ? 'bg-[#1c1b1d] text-[#4edea3] border-b-2 border-[#4edea3] font-medium'
                        : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                    }`}
                  >
                    HTTP Access Stream
                  </button>
                </div>
              </div>

              {/* Status Indicator & Terminal Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 font-mono text-xs text-[#bbcabf]">
                  <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse-glow" />
                  <span className="text-[#86948a]">Connected:</span>
                  <span className="text-[#e5e1e4]">prod-api-gateway-c87d4984f-2x9l</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    placeholder="Filter logs..."
                    className="bg-[#1c1b1d] border border-[#3c4a42] rounded px-2.5 py-1 font-mono text-xs text-[#e5e1e4] focus:outline-none focus:border-[#4cd7f6] w-36"
                  />
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`px-2 py-1 bg-[#1c1b1d] border border-[#3c4a42] rounded font-mono text-xs flex items-center gap-1 active:scale-95 transition-transform ${
                      autoScroll ? 'text-[#4edea3]' : 'text-[#86948a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">vertical_align_bottom</span>
                    <span>Auto-scroll</span>
                  </button>
                  <button
                    onClick={() => setLogs([])}
                    className="p-1 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded active:scale-95 transition-all"
                    title="Clear terminal buffer"
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Terminal Body */}
            <div
              ref={terminalRef}
              className="p-4 font-mono text-xs space-y-1.5 overflow-x-auto text-[#e5e1e4]/90 leading-relaxed max-h-72 bg-[#0e0e10]"
            >
              {filteredLogs.length === 0 ? (
                <div className="text-[#86948a] py-2">-- No matching log lines in buffer. Stream active... --</div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#86948a] shrink-0">[{log.timestamp}]</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        log.level === 'INFO'
                          ? 'text-[#4cd7f6]'
                          : log.level === 'BUILD'
                          ? 'text-[#4edea3]'
                          : log.level === 'SUCCESS'
                          ? 'text-[#4edea3]'
                          : log.level === 'ROUTING'
                          ? 'text-[#4edea3]'
                          : log.level === 'RUN'
                          ? 'text-[#4edea3]'
                          : 'text-[#d0bcff]'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[#e5e1e4]">{log.message}</span>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2 pt-1 border-t border-[#3c4a42]/40 mt-2 text-[#86948a]">
                <span className="text-[#4edea3] font-bold">✓ Deployment complete.</span>
                <span className="text-[#e5e1e4]">Available at:</span>
                <a href="https://api.cloudscale.io" className="text-[#4cd7f6] hover:underline">
                  https://api.cloudscale.io
                </a>
                <span className="text-[11px]">(Latency: 38ms from Frankfurt edge)</span>
              </div>
            </div>
          </section>

          <div className="h-10" />
        </main>
      </div>

      {/* Add Domain Modal */}
      {showAddDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#1c1b1d] border border-[#4edea3]/30 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowAddDomainModal(false)}
              className="absolute top-4 right-4 text-[#86948a] hover:text-[#e5e1e4]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[#4cd7f6]">alt_route</span>
              <h3 className="text-base font-semibold text-[#e5e1e4]">Add Custom Domain</h3>
            </div>
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#bbcabf] mb-1">Domain Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. api.yourcompany.com"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg px-3 py-2 text-xs font-mono text-[#e5e1e4] focus:outline-none focus:border-[#4edea3]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#bbcabf] mb-1">Target Service</label>
                <select
                  value={newDomainTarget}
                  onChange={(e) => setNewDomainTarget(e.target.value)}
                  className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg px-3 py-2 text-xs font-mono text-[#e5e1e4] focus:outline-none focus:border-[#4edea3]"
                >
                  <option value="api-gateway.internal">api-gateway.internal</option>
                  <option value="web-frontend.internal">web-frontend.internal</option>
                  <option value="auth-service.internal">auth-service.internal</option>
                </select>
              </div>
              <p className="text-[11px] text-[#86948a]">
                CloudScale will automatically request and renew a free Let's Encrypt Wildcard SSL certificate.
              </p>
              <button
                type="submit"
                className="w-full py-2 bg-[#4edea3] text-[#003824] font-semibold text-xs rounded-lg hover:bg-[#6ffbbe] transition-all cursor-pointer"
              >
                Provision Domain &amp; SSL
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
