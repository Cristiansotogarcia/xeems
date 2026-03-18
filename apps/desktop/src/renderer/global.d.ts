export interface AgentStatus {
  signedIn: boolean;
  requiresLogin: boolean;
  enrolled: boolean;
  monitoringAllowed: boolean;
  monitoringActive: boolean;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  deviceId: string | null;
  deviceUuid: string;
  deviceName: string | null;
  lastSeenAt: string | null;
  agentMessage: string;
  platform: string;
}

export interface ElectronAPI {
  login: (email: string, password: string) => Promise<{ success: boolean; userId?: string; error?: string }>;
  isConfigured: () => Promise<{ configured: boolean; hasSupabase: boolean }>;
  getAgentStatus: () => Promise<AgentStatus>;
  syncNow: () => Promise<{ success: boolean; error?: string }>;
  getVersion: () => Promise<{ version: string }>;
  getPlatform: () => Promise<{ platform: string }>;
  debugEnv: () => Promise<{ supabaseUrl: string; supabaseAnonKey: string; nodeEnv: string }>;
  onAgentStatus: (callback: (status: AgentStatus) => void) => () => void;
  onActivityUpdate: (callback: (activity: any) => void) => () => void;
  onIdleEvent: (callback: (event: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
