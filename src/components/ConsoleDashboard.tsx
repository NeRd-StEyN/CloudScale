import React, { useState, useRef, useEffect } from 'react';
import { ThreeMicroVmScene } from './ThreeMicroVmScene.tsx';
import { CloudScaleLogo } from './CloudScaleLogo.tsx';
import { ServiceWorkload, DomainItem, TerminalLog } from '../types.ts';
import { useAuth, UserButton, SignedIn, RedirectToSignIn, useUser } from '@clerk/clerk-react';

interface ConsoleDashboardProps {
  onNavigateToLanding: () => void;
}

export const ConsoleDashboard: React.FC<ConsoleDashboardProps> = ({ onNavigateToLanding }) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const hasGitHubConnected = user?.externalAccounts.some(
    account =>
      account.provider === 'oauth_github' ||
      account.provider === 'github' ||
      account.verification?.strategy === 'oauth_github'
  ) || false;

  const handleConnectGitHub = async () => {
    if (!user) return;
    try {
      const externalAccount = await user.createExternalAccount({
        strategy: 'oauth_github',
        redirectUrl: window.location.href,
        redirect_url: window.location.href, // fallback for older Clerk sdks
      } as any);

      const authUrl = externalAccount.verification?.externalVerificationRedirectURL?.href;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        console.warn('No redirect URL found:', externalAccount);
      }
    } catch (err: any) {
      console.error('Failed to connect GitHub:', err);
      showToast('Failed to connect GitHub: ' + (err.errors?.[0]?.message || err.message || 'Unknown error'));
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null);
  const [showEnvPasteModal, setShowEnvPasteModal] = useState<boolean>(false);
  const [envPasteContent, setEnvPasteContent] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  const [services, setServices] = useState<ServiceWorkload[]>([]);
  const [databases, setDatabases] = useState<any[]>([]);
  const [dbTargetServiceId, setDbTargetServiceId] = useState<string>('');
  const [isProvisioningDb, setIsProvisioningDb] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'http' | 'workers'>('all');
  const [activeNav, setActiveNav] = useState<string>('Overview');
  const [selectedVpc, setSelectedVpc] = useState<string>('prod-primary-vpc');
  const [deployRepoUrl, setDeployRepoUrl] = useState<string>('https://github.com/cloudscale-labs/api-gateway');
  const [deployBranch, setDeployBranch] = useState<string>('main');
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [isCustomUrl, setIsCustomUrl] = useState<boolean>(false);
  const [debugOutput, setDebugOutput] = useState<string>('');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [detectedFramework, setDetectedFramework] = useState<string>('');
  const [systemMetrics, setSystemMetrics] = useState<{ memUsedMb: number, memTotalMb: number, cpuPercent: number, bandwidthGb: number } | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showEnvVars, setShowEnvVars] = useState<boolean>(false);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
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

  // ─── Services fetch helper (shared between load + sync) ───────────────────
  const fetchDatabases = React.useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/databases', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDatabases(data.databases || []);
      }
    } catch (err) {}
  }, [getToken]);

  const fetchServices = React.useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const activeServices = data.services.filter((s: any) => s.status !== 'deleted');
        setServices(activeServices.map((s: any) => {
            const isWorker = s.kind === 'worker';
            const baseDomain = window.location.hostname === 'localhost'
              ? `${s.id}.localhost:8000`
              : `${s.id}.${window.location.hostname}`;
            return {
              id: s.id,
              name: s.repoUrl.split('/').pop()?.replace('.git', '') || s.id,
              kind: isWorker ? 'worker' : 'http',
              status: s.status === 'active' ? 'healthy' : s.status,
              environment: 'Production',
              region: 'local-edge',
              commitHash: 'latest',
              branch: s.branch || 'main',
              replicas: s.replicas || 1,
              replicasSummary: isWorker ? 'Worker' : `${s.replicas || 1} Replica${s.replicas > 1 ? 's' : ''}`,
              endpoint: isWorker ? undefined : `http://${baseDomain}`,
              domains: isWorker ? [] : [`${s.id}.localhost`],
              icon: isWorker ? 'memory' : 'rocket_launch',
              iconColor: isWorker ? 'text-yellow-400' : 'text-[#4edea3]',
              framework: s.framework || undefined,
              customDomains: s.customDomains || []
            };
          })
        );
        
        const allDomains = activeServices.flatMap((s: any) => s.customDomains || []);
        setDomains(allDomains);
      }
    } catch (e) {
      console.error('Failed to fetch services', e);
    }
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn) fetchServices();
    // Auto-refresh every 15s to catch in-progress deployments
    const interval = setInterval(() => { if (isSignedIn) fetchServices(); }, 15000);
    return () => clearInterval(interval);
  }, [isSignedIn, fetchServices]);

  useEffect(() => {
    const fetchRepos = async () => {
      if (!hasGitHubConnected || !isSignedIn) {
        setDebugOutput(`Skipped. hasGitHubConnected=${hasGitHubConnected}, isSignedIn=${isSignedIn}`);
        return;
      }
      setIsLoadingRepos(true);
      setDebugOutput('Fetching...');
      try {
        const token = await getToken();
        if (!token) {
          setDebugOutput(`Token is null!`);
          return;
        }
        const res = await fetch('/api/github/repos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDebugOutput(`Success! Fetched ${data.repos?.length} repos.`);
          setGithubRepos(data.repos || []);
          if (data.repos?.length > 0 && deployRepoUrl === 'https://github.com/cloudscale-labs/api-gateway') {
            setDeployRepoUrl(data.repos[0].html_url);
          }
        } else {
          setDebugOutput(`Failed: ${res.status} ${res.statusText}. Body: ${await res.text()}`);
        }
      } catch (err: any) {
        setDebugOutput(`Error: ${err.message}`);
        console.error('Failed to fetch repos', err);
      } finally {
        setIsLoadingRepos(false);
      }
    };
    fetchRepos();
  }, [hasGitHubConnected, isSignedIn, getToken]);

  // Fetch real branches when selected repo changes
  useEffect(() => {
    const fetchBranches = async () => {
      if (!deployRepoUrl || isCustomUrl || !deployRepoUrl.includes('github.com')) return;
      // Extract owner/repo from URL e.g. https://github.com/owner/repo
      const match = deployRepoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return;
      const [, owner, repo] = match;
      setIsLoadingBranches(true);
      try {
        const token = await getToken();
        // Fetch branches
        const branchRes = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (branchRes.ok) {
          const { branches: b } = await branchRes.json();
          setBranches(b || ['main']);
          if (b && b.length > 0 && !b.includes(deployBranch)) setDeployBranch(b[0]);
        }
        // Detect framework
        const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`);
        if (pkgRes.ok) {
          const pkg = await pkgRes.json();
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          if (deps['next']) setDetectedFramework(`Next.js ${deps['next'].replace(/[^\d.]/g, '')}`);
          else if (deps['vite']) setDetectedFramework('Vite');
          else if (deps['react-scripts']) setDetectedFramework('Create React App');
          else if (deps['@angular/core']) setDetectedFramework('Angular');
          else if (deps['vue']) setDetectedFramework('Vue.js');
          else if (deps['express']) setDetectedFramework('Express.js');
          else setDetectedFramework('');
        } else {
          setDetectedFramework('');
        }
      } catch {
        setBranches(['main']);
      } finally {
        setIsLoadingBranches(false);
      }
    };
    fetchBranches();
  }, [deployRepoUrl, isCustomUrl, getToken]);

  // Fetch real system metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) setSystemMetrics(await res.json());
      } catch { }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncCluster = async () => {
    setIsSyncing(true);
    await fetchServices();
    setIsSyncing(false);
    const now = new Date().toTimeString().split(' ')[0];
    setLogs(prev => [
      ...prev,
      { timestamp: now, level: 'INFO', message: `Services refreshed: ${services.length} deployment(s) loaded from server.` },
    ]);
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
        body: JSON.stringify({
          repoUrl: deployRepoUrl,
          branch: deployBranch,
          envVars: envVars.filter(e => e.key.trim() !== '').reduce((acc, e) => ({ ...acc, [e.key.trim()]: e.value }), {})
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deploy failed');
      }

      // Poll for logs + completion status
      const interval = setInterval(async () => {
        try {
          const t = await getToken();
          const logRes = await fetch(`/api/logs/${data.id}`, {
            headers: { 'Authorization': `Bearer ${t}` }
          });
          if (logRes.ok) {
            const logData = await logRes.json();
            const now = new Date().toTimeString().split(' ')[0];
            const newLogs = logData.logs.map((msg: string, i: number) => ({
              timestamp: `${now}.${String(i).padStart(3, '0')}`,
              level: msg.startsWith('❌') ? 'ERROR'
                : msg.startsWith('✅') ? 'SUCCESS'
                : msg.startsWith('🔨') || msg.startsWith('📦') ? 'BUILD'
                : msg.startsWith('🚀') ? 'RUN'
                : 'INFO',
              message: msg
            }));
            setLogs(newLogs);

            // Detect terminal states
            const isDone = logData.logs.some((m: string) =>
              m.includes('Deployment live at') ||
              m.includes('Worker is running') ||
              m.includes('failed') ||
              m.includes('❌')
            );
            if (isDone) {
              clearInterval(interval);
              setIsDeploying(false);
              // Refresh the full services list from server (gets real kind/framework)
              await fetchServices();
            }
          }
        } catch {
          // ignore transient network errors while polling
        }
      }, 1500);

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

  const handleDeleteDeployment = async (serviceId: string, serviceName: string) => {
    setDeleteConfirmation({ id: serviceId, name: serviceName });
  };
  
  const confirmDeleteDeployment = async () => {
    if (!deleteConfirmation) return;
    const { id: serviceId, name: serviceName } = deleteConfirmation;
    setDeleteConfirmation(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/deploy/${serviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setServices(prev => prev.filter(s => s.id !== serviceId));
        const now = new Date().toTimeString().split(' ')[0];
        setLogs(prev => [
          ...prev,
          { timestamp: now, level: 'INFO', message: `Deployment '${serviceName}' deleted successfully.` },
        ]);
      } else {
        const data = await res.json();
        showToast(`Failed to delete: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleApplyScaling = async () => {
    if (!targetServiceId || targetServiceId === 's1') {
      showToast("Please select a target workload first");
      return;
    }
    setIsScalingApplied(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/deploy/${targetServiceId}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ replicas: replicaCount })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to scale');
      }
      
      setServices((prev) =>
        prev.map((s) =>
          s.id === targetServiceId
            ? {
              ...s,
              replicas: replicaCount,
              replicasSummary: `${replicaCount} Replica${replicaCount > 1 ? 's' : ''}`,
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
          message: `Replica scaling applied: target=${services.find((s) => s.id === targetServiceId)?.name} count=${replicaCount} (${(replicaCount * 0.25).toFixed(1)} vCPU, ${replicaCount * 512} MB RAM)`,
        },
      ]);
    } catch (e: any) {
      showToast(`Scaling failed: ${e.message}`);
    } finally {
      setTimeout(() => setIsScalingApplied(false), 1500);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim() || !newDomainTarget) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/deploy/${newDomainTarget}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain: newDomainName.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add domain');
      }
      
      await fetchServices(); // refresh list to get new domains
      setNewDomainName('');
      setNewDomainTarget('');
      setShowAddDomainModal(false);
    } catch (e: any) {
      showToast(`Domain mapping failed: ${e.message}`);
    }
  };

  const filteredServices = services.filter((s) => {
    if (filter === 'http') return s.kind === 'http';
    if (filter === 'workers') return s.kind === 'worker';
    return true;
  }).filter((s) => {
    if (!globalSearch.trim()) return true;
    return s.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
      s.region.toLowerCase().includes(globalSearch.toLowerCase()) ||
      (s.framework || '').toLowerCase().includes(globalSearch.toLowerCase());
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
              onClick={() => showToast('Support portal: Connected to 24/7 dedicated enterprise infrastructure team.')}
              className="text-sm text-[#bbcabf] hover:text-[#e5e1e4] transition-colors"
            >
              Support
            </button>
            <button
              onClick={() => showToast('Changelog: v2.4.0 active with Anycast mesh routing and Firecracker v2.')}
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
          {/* Quick Action Icons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => showToast('No active alerts.')}
              className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </button>
            <button
              onClick={() => showToast('Help: Docs, API specs, and CLI instructions available in sidebar.')}
              className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
              title="Help"
            >
              <span className="material-symbols-outlined text-[18px]">help</span>
            </button>
          </div>



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
            {/* Environment Selector */}
            <div className="relative">
              <select
                value={selectedVpc}
                onChange={(e) => setSelectedVpc(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#1c1b1d]/90 border border-[#3c4a42] hover:border-[#4edea3]/40 rounded-lg text-xs font-mono text-[#e5e1e4] appearance-none cursor-pointer focus:outline-none focus:border-[#4edea3]"
              >
                <option value="prod-primary-vpc">Environment (Production)</option>
                <option value="staging-mesh-eu">Environment (Staging)</option>
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
                { name: 'Scaling', icon: 'tune' },
                { name: 'Subdomain Routing', icon: 'alt_route' },
                { name: 'Settings', icon: 'settings' },
              ].map((item) => {
                const isActive = activeNav === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      setActiveNav(item.name);
                      let sectionId = '';
                      if (item.name === 'Overview') sectionId = 'overview-section';
                      if (item.name === 'Services & Deployments') sectionId = 'services-section';
                      if (item.name === 'Logs & Metrics') sectionId = 'deployment-logs-section';
                      if (item.name === 'Scaling') sectionId = 'replica-scaling-section';
                      if (item.name === 'Subdomain Routing') sectionId = 'subdomain-routing-section';

                      if (sectionId) {
                        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all text-left ${isActive
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
              onClick={() => showToast('CloudScale Documentation v2.4')}
              className="w-full flex items-center gap-3 px-3 py-2 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#1c1b1d] text-xs rounded-lg transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Documentation</span>
            </button>
            <button
              onClick={() => showToast('All edge PoPs operational (SLA: 99.999%).')}
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
        <main id="overview-section" className="flex-1 overflow-y-auto bg-[#0e0e10] px-4 lg:px-8 py-6 max-w-[1440px] mx-auto w-full">
          {/* Sub-Header Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#3c4a42]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl text-[#e5e1e4] font-semibold tracking-tight">Project Dashboard</h1>
              </div>
              <p className="text-xs text-[#bbcabf] mt-0.5">
                Manage and deploy your applications.
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
                <span>{isSyncing ? 'Syncing...' : 'Sync Deployments'}</span>
              </button>

            </div>
          </div>

          {/* 3D Holographic MicroVM & Topology Card */}
          <section className="mt-6 rounded-xl bg-gradient-to-r from-[#131315] via-[#1c1b1d]/90 to-[#131315] border border-[#4edea3]/25 shadow-2xl shadow-black/70 backdrop-blur-md relative overflow-hidden tilt-card">
            <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-b from-[#4edea3]/15 via-[#4cd7f6]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-72 h-40 bg-[#4cd7f6]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-5 flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* Left Side: Info */}
              <div className="flex-1 space-y-3 w-full lg:max-w-md">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold tracking-wider bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] flex items-center gap-1.5 shadow-sm shadow-[#4edea3]/20">
                    <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse-glow" />
                    SYSTEM STATUS
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[#e5e1e4] tracking-tight">
                    Global Infrastructure
                  </h3>
                  <p className="text-xs text-[#bbcabf] mt-1 leading-relaxed">
                    Visual representation of your active deployments and server nodes.
                  </p>
                </div>
              </div>

              {/* Right Side: 3D Scene */}
              <div className="w-full lg:flex-1 h-48 md:h-56 relative rounded-xl border border-[#3c4a42]/60 bg-[#0e0e10]/80 overflow-hidden flex items-center justify-center shadow-inner">
                <ThreeMicroVmScene />
              </div>
            </div>
          </section>

          {/* Quick GitHub Repository Deploy Hero Bar */}
          <section className="mt-6 p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] shadow-xl relative overflow-hidden tilt-card">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 relative z-10">
              {!hasGitHubConnected ? (
                <div className="flex-1 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-[#bbcabf]">
                    <span className="material-symbols-outlined text-[#4cd7f6]">link</span>
                    <span>Please connect your GitHub account to enable automatic deployments.</span>
                  </div>
                  <button
                    onClick={handleConnectGitHub}
                    className="px-4 py-2 rounded-lg bg-[#2a2a2c] border border-[#3c4a42] text-[#e5e1e4] text-xs font-semibold hover:bg-[#3c4a42] transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">integration_instructions</span>
                    Connect GitHub
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    <div className="relative flex-1 flex flex-col gap-2">
                      {isLoadingRepos ? (
                        <div className="flex items-center gap-2 text-xs text-[#bbcabf] py-2">
                          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                          Loading your repositories...
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#bbcabf]">
                            <span className="material-symbols-outlined text-[18px]">code_blocks</span>
                          </div>
                          <select
                            value={isCustomUrl ? 'custom' : deployRepoUrl}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom') {
                                setIsCustomUrl(true);
                                setDeployRepoUrl('');
                              } else {
                                setIsCustomUrl(false);
                                setDeployRepoUrl(val);
                              }
                            }}
                            className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg pl-9 pr-8 py-2 text-xs font-mono text-[#e5e1e4] appearance-none focus:outline-none focus:border-[#4cd7f6] cursor-pointer"
                          >
                            {githubRepos.length === 0 && <option value="" disabled>No repositories found</option>}
                            {githubRepos.map(repo => (
                              <option key={repo.id} value={repo.html_url}>{repo.full_name}</option>
                            ))}
                            <option value="custom">Paste custom URL...</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[#bbcabf]">
                            <span className="material-symbols-outlined text-[16px]">expand_more</span>
                          </div>
                        </div>
                      )}

                      {isCustomUrl && (
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#bbcabf]">
                            <span className="material-symbols-outlined text-[18px]">link</span>
                          </div>
                          <input
                            type="text"
                            value={deployRepoUrl}
                            onChange={(e) => setDeployRepoUrl(e.target.value)}
                            className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-[#e5e1e4] focus:outline-none focus:border-[#4cd7f6] focus:ring-1 focus:ring-[#4cd7f6] transition-all"
                            placeholder="https://github.com/username/repo-name"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>

                    <div className="relative min-w-[140px]">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#bbcabf]">
                        <span className="material-symbols-outlined text-[16px]">fork_right</span>
                      </div>
                      <select
                        value={deployBranch}
                        onChange={(e) => setDeployBranch(e.target.value)}
                        disabled={isLoadingBranches}
                        className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg pl-8 pr-8 py-2 text-xs font-mono text-[#e5e1e4] appearance-none focus:outline-none focus:border-[#4cd7f6] cursor-pointer disabled:opacity-50"
                      >
                        {isLoadingBranches
                          ? <option>Loading branches...</option>
                          : branches.map(b => <option key={b} value={b}>{b}</option>)
                        }
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[#bbcabf]">
                        <span className={`material-symbols-outlined text-[16px] ${isLoadingBranches ? 'animate-spin' : ''}`}>{isLoadingBranches ? 'progress_activity' : 'expand_more'}</span>
                      </div>
                    </div>

                    {detectedFramework && (
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1c1b1d] border border-[#3c4a42] text-xs font-mono text-[#4cd7f6] shrink-0">
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>{detectedFramework} detected</span>
                      </div>
                    )}
                  </div>

                  {/* Environment Variables Panel */}
                  <div className="mt-3 rounded-xl border border-[#3c4a42] overflow-hidden">
                    <button
                      onClick={() => setShowEnvVars(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0e0e10] hover:bg-[#1a1a1c] transition-colors text-xs text-[#bbcabf] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">key</span>
                        <span className="font-semibold text-[#e5e1e4]">Environment Variables</span>
                        {envVars.filter(e => e.key.trim()).length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#4cd7f6]/20 text-[#4cd7f6] text-[10px] font-bold">
                            {envVars.filter(e => e.key.trim()).length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#bbcabf]">

                        <span className="material-symbols-outlined text-[14px]">{showEnvVars ? 'expand_less' : 'expand_more'}</span>
                      </div>
                    </button>

                    {showEnvVars && (
                      <div className="bg-[#131315] px-4 pt-3 pb-4 space-y-2">
                        <p className="text-[10px] text-[#bbcabf] mb-3">
                          These will be written to <code className="text-[#4cd7f6]">.env</code> in the project before it starts. Never commit secrets to git — add them here instead.
                        </p>
                        {envVars.map((ev, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={ev.key}
                              onChange={e => setEnvVars(prev => prev.map((p, j) => j === i ? { ...p, key: e.target.value } : p))}
                              placeholder="KEY"
                              className="flex-1 bg-[#0e0e10] border border-[#3c4a42] rounded-lg px-3 py-1.5 text-xs font-mono text-[#4cd7f6] placeholder:text-[#4c5a52] focus:outline-none focus:border-[#4cd7f6] uppercase"
                            />
                            <span className="text-[#bbcabf] text-xs">=</span>
                            <input
                              type="text"
                              value={ev.value}
                              onChange={e => setEnvVars(prev => prev.map((p, j) => j === i ? { ...p, value: e.target.value } : p))}
                              placeholder="value"
                              className="flex-[2] bg-[#0e0e10] border border-[#3c4a42] rounded-lg px-3 py-1.5 text-xs font-mono text-[#e5e1e4] placeholder:text-[#4c5a52] focus:outline-none focus:border-[#4cd7f6]"
                            />
                            <button
                              onClick={() => setEnvVars(prev => prev.length === 1 ? [{ key: '', value: '' }] : prev.filter((_, j) => j !== i))}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#bbcabf] hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => setEnvVars(prev => [...prev, { key: '', value: '' }])}
                            className="flex items-center gap-1.5 text-[11px] text-[#4edea3] hover:text-[#6ffbbe] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            Add variable
                          </button>
                          <span className="text-[#3c4a42]">·</span>
                          <button
                            onClick={() => setShowEnvPasteModal(true)}
                            className="flex items-center gap-1.5 text-[11px] text-[#bbcabf] hover:text-[#e5e1e4] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">content_paste</span>
                            Paste .env file
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 mt-3">
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
                </>
              )}
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
              <div className="mt-1 text-[11px] text-[#bbcabf] font-mono">
                {services.filter(s => s.status === 'degraded' || s.status === 'failed').length} Failed
                · {services.filter(s => s.status === 'deploying').length} Deploying
              </div>
            </div>

            {/* RAM Usage */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4cd7f6]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>Memory Usage</span>
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">memory</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">{systemMetrics ? `${systemMetrics.memUsedMb} MB` : '...'}</span>
                <span className="font-mono text-xs text-[#bbcabf]">/ {systemMetrics ? `${systemMetrics.memTotalMb} MB` : '...'}</span>
              </div>
              <div className="mt-2 w-full bg-[#2a2a2c] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#4cd7f6] h-full rounded-full transition-all duration-1000" style={{ width: systemMetrics ? `${(systemMetrics.memUsedMb / systemMetrics.memTotalMb * 100).toFixed(1)}%` : '0%' }} />
              </div>
            </div>

            {/* CPU Usage */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4edea3]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>CPU Usage</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">developer_board</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">{systemMetrics ? `${systemMetrics.cpuPercent}%` : '...'}</span>
                <span className={`font-mono text-xs font-medium ${systemMetrics && systemMetrics.cpuPercent > 80 ? 'text-red-400' : 'text-[#4edea3]'}`}>{systemMetrics ? (systemMetrics.cpuPercent > 80 ? 'High' : 'Healthy') : ''}</span>
              </div>
              <div className="mt-2 w-full bg-[#2a2a2c] rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${systemMetrics && systemMetrics.cpuPercent > 80 ? 'bg-red-400' : 'bg-[#4edea3]'}`} style={{ width: systemMetrics ? `${systemMetrics.cpuPercent}%` : '0%' }} />
              </div>
            </div>

            {/* Network Sent This Session */}
            <div className="p-4 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#d0bcff]/40 tilt-card">
              <div className="flex items-center justify-between text-[#bbcabf] text-xs">
                <span>Network Sent (Session)</span>
                <span className="material-symbols-outlined text-[#d0bcff] text-[18px]">data_usage</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#e5e1e4]">{systemMetrics ? `${systemMetrics.bandwidthGb.toFixed(2)} GB` : '...'}</span>
              </div>
              <div className="mt-2 w-full bg-[#2a2a2c] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#d0bcff] h-full rounded-full transition-all duration-1000" style={{ width: systemMetrics ? `${Math.min(systemMetrics.bandwidthGb / 50 * 100, 100).toFixed(1)}%` : '0%' }} />
              </div>
            </div>
          </section>

          {/* Active Workloads & Services */}
          <section id="services-section" className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg text-[#e5e1e4] font-semibold">Active Deployments</h2>
                <p className="text-xs text-[#bbcabf]">Your currently deployed applications.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#bbcabf]">Filter:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all active:scale-95 ${filter === 'all'
                      ? 'bg-[#201f22] border border-[#4edea3]/30 text-[#4edea3]'
                      : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#201f22]/60'
                    }`}
                >
                  All ({services.length})
                </button>
                <button
                  onClick={() => setFilter('http')}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all active:scale-95 ${filter === 'http'
                      ? 'bg-[#201f22] border border-[#4edea3]/30 text-[#4edea3]'
                      : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#201f22]/60'
                    }`}
                >
                  HTTP ({services.filter((s) => s.kind === 'http').length})
                </button>
                <button
                  onClick={() => setFilter('workers')}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all active:scale-95 ${filter === 'workers'
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
                        {/* Framework badge */}
                        {service.framework && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#2a2a2c] text-[#bbcabf] border border-[#3c4a42]">
                            {service.framework}
                          </span>
                        )}
                        {/* Kind badge: Worker vs Active/Deploying/Failed */}
                        {service.kind === 'worker' ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                            Worker
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1.5 ${
                            service.status === 'healthy'
                              ? 'bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3]'
                              : service.status === 'deploying'
                              ? 'bg-yellow-400/10 border border-yellow-400/30 text-yellow-400'
                              : 'bg-red-400/10 border border-red-400/30 text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              service.status === 'healthy' ? 'bg-[#4edea3] animate-pulse-glow'
                              : service.status === 'deploying' ? 'bg-yellow-400 animate-pulse'
                              : 'bg-red-400'
                            }`} />
                            {service.status === 'healthy' ? 'Active' : service.status === 'deploying' ? 'Deploying...' : service.status}
                          </span>
                        )}
                        <span className="text-xs text-[#bbcabf]">{service.environment}</span>
                        <span className="text-[#bbcabf]">•</span>
                        <span className="text-xs text-[#bbcabf]">{service.region}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 font-mono text-xs text-[#bbcabf] flex-wrap">
                        <span className="flex items-center gap-1 text-[#86948a]">
                          <span className="material-symbols-outlined text-[14px]">commit</span>
                          {service.branch}@latest
                        </span>
                        <span>•</span>
                        <span className="text-[#4cd7f6] font-medium">{service.replicasSummary}</span>
                        {/* Only show URL link for HTTP services */}
                        {service.kind === 'http' && service.endpoint ? (
                          <>
                            <span>•</span>
                            <a
                              href={service.endpoint}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#bbcabf] hover:text-[#4cd7f6] flex items-center gap-1 underline underline-offset-2 transition-colors"
                            >
                              {service.endpoint.replace('http://', '')}
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </a>
                          </>
                        ) : service.kind === 'worker' ? (
                          <>
                            <span>•</span>
                            <span className="text-yellow-400/70">Background process — no public URL</span>
                          </>
                        ) : null}
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
                      className={`p-1.5 hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors ${
                        service.kind === 'worker' ? 'text-[#3c4a42] cursor-not-allowed' : 'text-[#bbcabf]'
                      }`}
                      title={service.kind === 'worker' ? 'Replica scaling not available for workers' : 'Scale Replicas'}
                      disabled={service.kind === 'worker'}
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                    </button>
                    <button
                      onClick={() => showToast(`Settings for ${service.name}: All environment secrets and build args intact.`)}
                      className="p-1.5 text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c] rounded transition-colors"
                      title="Settings"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDeployment(service.id, service.name)}
                      className="p-1.5 text-[#bbcabf] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete Deployment"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

                    {/* Managed Databases */}
          <section id="databases-section" className="mt-8 p-5 rounded-xl bg-[#131315]/90 backdrop-blur-md border border-[#3c4a42] hover:border-[#4cd7f6]/30 shadow-xl tilt-card">
            <div className="flex items-center justify-between pb-3 border-b border-[#3c4a42] mb-4">
              <div>
                <h3 className="text-base text-[#e5e1e4] font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4cd7f6]">database</span>
                  Managed Databases
                </h3>
                <p className="text-xs text-[#bbcabf] mt-1">Spin up isolated Postgres or Redis containers, automatically injected into your deployments via Env Vars.</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#e5e1e4] mb-1">Target Deployment</label>
                <select 
                  value={dbTargetServiceId} 
                  onChange={(e) => setDbTargetServiceId(e.target.value)}
                  className="w-full bg-[#0e0e10] border border-[#3c4a42] rounded-lg px-3 py-2 text-xs font-mono text-[#e5e1e4] focus:outline-none focus:border-[#4cd7f6]"
                >
                  <option value="">-- Select Deployment --</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                </select>
              </div>
              <div className="flex gap-3 items-end">
                <button
                  onClick={() => handleCreateDatabase('postgres')}
                  disabled={isProvisioningDb}
                  className="px-4 py-2 bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-[#4cd7f6] hover:bg-[#4cd7f6]/20 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">storage</span>
                  Postgres
                </button>
                <button
                  onClick={() => handleCreateDatabase('redis')}
                  disabled={isProvisioningDb}
                  className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">memory</span>
                  Redis
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {databases.map(db => (
                <div key={db.id} className="p-3 border border-[#3c4a42] bg-[#1c1b1d] rounded-lg relative group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`material-symbols-outlined text-[18px] ${db.type === 'postgres' ? 'text-[#4cd7f6]' : 'text-red-400'}`}>
                      {db.type === 'postgres' ? 'storage' : 'memory'}
                    </span>
                    <span className="font-semibold text-sm text-[#e5e1e4] capitalize">{db.type} Container</span>
                  </div>
                  <div className="text-xs text-[#bbcabf] font-mono break-all bg-[#0e0e10] p-2 rounded">
                    {db.connectionString.replace(/:[^:@]+@/, ':••••••@')}
                  </div>
                  <div className="text-[11px] text-[#bbcabf] mt-2 flex justify-between items-center">
                    <span>Linked to: <span className="font-mono text-[#e5e1e4]">{db.repoUrl.split('/').pop()}</span></span>
                    <span className="px-1.5 py-0.5 bg-[#4edea3]/10 text-[#4edea3] rounded border border-[#4edea3]/30">Running</span>
                  </div>
                </div>
              ))}
              {databases.length === 0 && <div className="text-xs text-[#bbcabf] italic col-span-2">No databases provisioned yet.</div>}
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
                    <p className="text-xs text-[#bbcabf] flex items-center mt-1">
                      Target workload:{' '}
                      <select 
                        value={targetServiceId} 
                        onChange={(e) => {
                          setTargetServiceId(e.target.value);
                          const s = services.find(x => x.id === e.target.value);
                          if (s) setReplicaCount(s.replicas || 1);
                        }}
                        className="bg-[#1c1b1d] border border-[#3c4a42] rounded px-2 py-1 text-xs font-mono text-[#4edea3] focus:outline-none ml-2 w-48 truncate cursor-pointer"
                      >
                        <option value="s1" disabled>-- Select a deployment --</option>
                        {services.filter(s => s.status === 'healthy').map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                        ))}
                      </select>
                    </p>
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


                  {/* Status Info */}
                  <div className="p-3 bg-[#1c1b1d] border border-[#3c4a42] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">info</span>
                        <span className="text-xs text-[#e5e1e4] font-medium">Single-node mode</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#bbcabf] px-2 py-0.5 rounded bg-[#2a2a2c] border border-[#3c4a42]">
                        Simulated
                      </span>
                    </div>
                    <p className="text-[11px] text-[#86948a] leading-relaxed">
                      Replica scaling is simulated on single-node deployments. For true horizontal scaling, use Docker Swarm or Kubernetes in production.
                    </p>
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
                <span>{domains.length} custom domain(s) configured</span>
                <button
                  onClick={() => showToast('Point your domain\'s CNAME or A record to this server IP, then click Add Domain.')}
                  className="text-[#4cd7f6] hover:underline flex items-center gap-1 transition-colors"
                >
                  How to configure
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
                    className={`px-3 py-1 font-mono text-xs transition-colors ${activeLogTab === 'build'
                        ? 'bg-[#1c1b1d] text-[#4edea3] border-b-2 border-[#4edea3] font-medium'
                        : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                      }`}
                  >
                    Build Logs
                  </button>
                  <button
                    onClick={() => setActiveLogTab('runtime')}
                    className={`px-3 py-1 font-mono text-xs transition-colors ${activeLogTab === 'runtime'
                        ? 'bg-[#1c1b1d] text-[#4edea3] border-b-2 border-[#4edea3] font-medium'
                        : 'text-[#bbcabf] hover:text-[#e5e1e4]'
                      }`}
                  >
                    Runtime Output
                  </button>
                  <button
                    onClick={() => setActiveLogTab('access')}
                    className={`px-3 py-1 font-mono text-xs transition-colors ${activeLogTab === 'access'
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
                  <span className="text-[#86948a]">Watching:</span>
                  <span className="text-[#e5e1e4]">
                    {services.length > 0
                      ? `${services[0].name} (${services[0].id})`
                      : 'No active deployments'}
                  </span>
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
                    className={`px-2 py-1 bg-[#1c1b1d] border border-[#3c4a42] rounded font-mono text-xs flex items-center gap-1 active:scale-95 transition-transform ${autoScroll ? 'text-[#4edea3]' : 'text-[#86948a]'
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
                <div className="text-[#86948a] py-2">
                  {logs.length === 0
                    ? '-- No logs yet. Deploy a project to see output here. --'
                    : '-- No matching log lines in buffer. --'}
                </div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#86948a] shrink-0">[{log.timestamp}]</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        log.level === 'ERROR' ? 'text-red-400'
                        : log.level === 'SUCCESS' ? 'text-[#4edea3]'
                        : log.level === 'BUILD' ? 'text-[#d0bcff]'
                        : log.level === 'RUN' ? 'text-[#4edea3]'
                        : log.level === 'INFO' ? 'text-[#4cd7f6]'
                        : 'text-[#bbcabf]'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[#e5e1e4] break-all">{log.message}</span>
                  </div>
                ))
              )}
              {/* Show latest active HTTP deployment at bottom of terminal */}
              {(() => {
                const latest = services.find(s => s.status === 'healthy' && s.kind === 'http');
                if (!latest) return null;
                return (
                  <div className="flex items-center gap-2 pt-1 border-t border-[#3c4a42]/40 mt-2 text-[#86948a] flex-wrap">
                    <span className="text-[#4edea3] font-bold">✓ Latest active deployment:</span>
                    <a
                      href={latest.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#4cd7f6] hover:underline font-mono"
                    >
                      {latest.endpoint}
                    </a>
                    <span className="text-[11px] text-[#86948a]">({latest.name})</span>
                  </div>
                );
              })()}
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
                  <option value="">-- Select a target service --</option>
                   {services.filter(s => s.kind === 'http' && s.status === 'healthy').map(s => (
                     <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                   ))}
                   {services.filter(s => s.kind === 'http' && s.status === 'healthy').length === 0 && (
                     <option disabled>No active HTTP deployments yet</option>
                   )}
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
      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#1c1b1d] border border-red-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-base font-semibold">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-[#bbcabf] mb-6 leading-relaxed">
              Are you sure you want to delete <span className="text-[#e5e1e4] font-semibold">"{deleteConfirmation.name}"</span>? This will stop and remove it permanently.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-xs font-semibold text-[#bbcabf] hover:text-[#e5e1e4] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDeployment}
                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold text-xs rounded-lg transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Env Paste Modal */}
      {showEnvPasteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#1c1b1d] border border-[#3c4a42] rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-base font-semibold text-[#e5e1e4] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4cd7f6]">content_paste</span>
              Paste .env contents
            </h3>
            <textarea
              value={envPasteContent}
              onChange={(e) => setEnvPasteContent(e.target.value)}
              placeholder="KEY=value\nANOTHER_KEY=another_value"
              className="w-full h-32 bg-[#0e0e10] border border-[#3c4a42] rounded-lg p-3 text-xs font-mono text-[#e5e1e4] placeholder:text-[#4c5a52] focus:outline-none focus:border-[#4cd7f6] mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEnvPasteModal(false);
                  setEnvPasteContent('');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#bbcabf] hover:text-[#e5e1e4] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!envPasteContent) return;
                  const parsed = envPasteContent.split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('#') && l.includes('='))
                    .map(l => { const idx = l.indexOf('='); return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim().replace(/^["']|["']$/g, '') }; });
                  if (parsed.length > 0) setEnvVars(parsed);
                  setEnvPasteContent('');
                  setShowEnvPasteModal(false);
                }}
                className="px-4 py-2 bg-[#4edea3] text-[#003824] hover:bg-[#6ffbbe] font-semibold text-xs rounded-lg transition-all cursor-pointer"
              >
                Parse & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-[100] bg-[#1c1b1d] border border-[#3c4a42] text-[#e5e1e4] px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in-up">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">info</span>
          <p className="text-xs font-medium">{toastMessage}</p>
          <button onClick={() => setToastMessage(null)} className="text-[#86948a] hover:text-[#e5e1e4] ml-2">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
