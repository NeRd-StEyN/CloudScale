export type ScreenMode = 'landing' | 'console';

export interface ServiceWorkload {
  id: string;
  name: string;
  kind: 'http' | 'worker';
  status: 'healthy' | 'degraded' | 'deploying' | 'failed' | 'deleted';
  environment: string;
  region: string;
  commitHash: string;
  branch: string;
  replicas: number;
  replicasSummary: string;
  endpoint?: string;
  domains?: string[];
  icon: string;
  iconColor: string;
  framework?: string;
}

export interface PopNode {
  id: string;
  code: string;
  location: string;
  pingMs: number;
}

export interface DomainItem {
  id: string;
  domain: string;
  target: string;
  sslStatus: string;
  provider: string;
  autoRenew: boolean;
}

export interface TerminalLog {
  timestamp: string;
  level: 'INFO' | 'BUILD' | 'SUCCESS' | 'PROV' | 'ROUTING' | 'RUN' | 'ERROR';
  message: string;
}
