import { IpcMain } from 'electron';
import log from 'electron-log';
import { SyncService } from './syncService';

interface HandlerDeps {
  getSyncService: () => SyncService | null;
  getAgentStatus: () => Record<string, unknown>;
}

export function setupIpcHandlers(ipcMain: IpcMain, deps: HandlerDeps): void {
  log.info('Setting up IPC handlers...');

  ipcMain.handle('sync-service:login', async (_, email: string, password: string) => {
    const syncService = deps.getSyncService();
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized.' };
    }

    return syncService.login(email, password);
  });

  ipcMain.handle('sync-service:is-configured', async () => {
    const syncService = deps.getSyncService();
    if (!syncService) {
      return { configured: false, hasSupabase: false };
    }

    return {
      configured: syncService.isConfigured(),
      hasSupabase: syncService.hasSupabase()
    };
  });

  ipcMain.handle('sync-service:get-status', async () => {
    return deps.getAgentStatus();
  });

  ipcMain.handle('sync-service:sync-now', async () => {
    const syncService = deps.getSyncService();
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized.' };
    }

    await syncService.syncPendingData();
    return { success: true };
  });

  ipcMain.handle('app:get-version', async () => {
    const { app } = require('electron');
    return { version: app.getVersion() };
  });

  ipcMain.handle('app:get-platform', async () => {
    return { platform: process.platform };
  });

  ipcMain.handle('app:debug-env', async () => {
    return {
      supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
      nodeEnv: process.env.NODE_ENV
    };
  });

  log.info('IPC handlers setup complete');
}
