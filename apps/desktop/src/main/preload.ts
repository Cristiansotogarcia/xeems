import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  login: (email: string, password: string) =>
    ipcRenderer.invoke('sync-service:login', email, password),
  isConfigured: () =>
    ipcRenderer.invoke('sync-service:is-configured') as Promise<{ configured: boolean; hasSupabase: boolean }>,
  getAgentStatus: () => ipcRenderer.invoke('sync-service:get-status'),
  syncNow: () =>
    ipcRenderer.invoke('sync-service:sync-now') as Promise<{ success: boolean; error?: string }>,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  debugEnv: () => ipcRenderer.invoke('app:debug-env'),
  onAgentStatus: (callback: (status: any) => void) => {
    const handler = (_event: IpcRendererEvent, status: any) => callback(status);
    ipcRenderer.on('agent-status', handler);
    return () => ipcRenderer.removeListener('agent-status', handler);
  },
  onActivityUpdate: (callback: (activity: any) => void) => {
    const handler = (_event: IpcRendererEvent, activity: any) => callback(activity);
    ipcRenderer.on('activity-update', handler);
    return () => ipcRenderer.removeListener('activity-update', handler);
  },
  onIdleEvent: (callback: (event: any) => void) => {
    const handler = (_event: IpcRendererEvent, event: any) => callback(event);
    ipcRenderer.on('idle-event', handler);
    return () => ipcRenderer.removeListener('idle-event', handler);
  }
});

export interface ElectronAPI {
  login: (email: string, password: string) => Promise<{ success: boolean; userId?: string; error?: string }>;
  isConfigured: () => Promise<{ configured: boolean; hasSupabase: boolean }>;
  getAgentStatus: () => Promise<any>;
  syncNow: () => Promise<{ success: boolean; error?: string }>;
  getVersion: () => Promise<{ version: string }>;
  getPlatform: () => Promise<{ platform: string }>;
  debugEnv: () => Promise<{ supabaseUrl: string; supabaseAnonKey: string; nodeEnv: string }>;
  onAgentStatus: (callback: (status: any) => void) => () => void;
  onActivityUpdate: (callback: (activity: any) => void) => () => void;
  onIdleEvent: (callback: (event: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
