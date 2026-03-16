export interface InstanceSummary {
  id: string;
  name: string;
  description?: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  currentModel: string;
  containerName: string;
  hostPort: number;
  cpuLimit?: number;
  memoryLimitMb?: number;
  createdAt: string;
  updatedAt: string;
  // Live stats injected by SignalR
  stats?: ContainerStats;
}

export interface InstanceDetail extends InstanceSummary {
  containerId?: string;
  configJson?: string;
}

export interface ContainerStats {
  instanceId: string;
  status: string;
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
}

export interface ChannelConfig {
  id: string;
  channelType: 'telegram' | 'whatsapp' | 'discord' | 'slack';
  isEnabled: boolean;
  updatedAt: string;
}

export interface SwitchRule {
  id: string;
  ruleType: 'threshold' | 'cron' | 'manual';
  triggerModel?: string;
  thresholdPct?: number;
  cronExpression?: string;
  targetModel: string;
  isActive: boolean;
  priority: number;
}
