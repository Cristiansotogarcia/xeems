import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';
import { ActivityTracker } from './activityTracker';
import { IdleDetector } from './idleDetector';
import { setupIpcHandlers } from './ipcHandlers';
import { ManagedAgentStatus, SyncService } from './syncService';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const startHidden = process.argv.includes('--hidden');

function loadEnvFile(): void {
  const envPaths = app.isPackaged
    ? [path.join(path.dirname(process.execPath), '.env')]
    : [path.join(__dirname, '../../.env.local'), path.join(__dirname, '../../.env')];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    log.info('[ENV] Loading env from:', envPath);

    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([^#\s][^=]*)=(.*)$/);
      if (!match) {
        continue;
      }

      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  }

  log.info('[ENV] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
  log.info('[ENV] SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
}

loadEnvFile();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activityTracker: ActivityTracker | null = null;
let idleDetector: IdleDetector | null = null;
let syncService: SyncService | null = null;
let watchdogInterval: NodeJS.Timeout | null = null;
let allowQuit = false;

function resolveAssetPath(fileName: string): string {
  return isDev ? path.join(__dirname, '../../assets', fileName) : path.join(process.resourcesPath, 'assets', fileName);
}

let agentStatus: ManagedAgentStatus = {
  signedIn: false,
  requiresLogin: true,
  enrolled: false,
  monitoringAllowed: false,
  userId: null,
  userName: null,
  userEmail: null,
  deviceId: null,
  deviceUuid: '',
  deviceName: null,
  lastSeenAt: null,
  agentMessage: 'Sign in once to enroll this company-owned laptop.'
};

function getRendererAgentStatus() {
  return {
    ...agentStatus,
    monitoringActive: Boolean(activityTracker?.getIsRunning() && idleDetector?.getIsRunning()),
    platform: process.platform
  };
}

function broadcastAgentStatus(): void {
  const payload = getRendererAgentStatus();
  mainWindow?.webContents.send('agent-status', payload);
}

function startMonitoring(): void {
  idleDetector?.start();
  activityTracker?.start();
  broadcastAgentStatus();
}

function stopMonitoring(): void {
  idleDetector?.stop();
  activityTracker?.stop();
  broadcastAgentStatus();
}

function applyManagedState(): void {
  const shouldMonitor = syncService?.shouldMonitor() ?? false;
  const isRunning = Boolean(activityTracker?.getIsRunning() && idleDetector?.getIsRunning());

  if (shouldMonitor && !isRunning) {
    log.info('Managed agent enabling monitoring.');
    startMonitoring();
    return;
  }

  if (!shouldMonitor && isRunning) {
    log.info('Managed agent disabling monitoring.');
    stopMonitoring();
    return;
  }

  broadcastAgentStatus();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 520,
    minHeight: 580,
    show: false,
    autoHideMenuBar: true,
    icon: resolveAssetPath('XEEMS_ICON.png'),
    title: 'XEEMS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow?.show();
    }
    broadcastAgentStatus();
  });

  mainWindow.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  let trayIcon = nativeImage.createFromPath(resolveAssetPath('XEEMS_ICON.png'));
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  } else if (process.platform === 'win32') {
    trayIcon = trayIcon.resize({ width: 18, height: 18 });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('XEEMS Desktop Agent');

  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Open XEEMS',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    }
  ];

  if (isDev) {
    items.push({ type: 'separator' });
    items.push({
      label: 'Quit (Dev)',
      click: () => {
        allowQuit = true;
        app.quit();
      }
    });
  }

  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

async function initializeServices(): Promise<void> {
  syncService = new SyncService((status) => {
    agentStatus = status;
    if (activityTracker) {
      activityTracker.setCategoryRules(syncService?.getCategoryRules() ?? []);
    }
    applyManagedState();
  });

  idleDetector = new IdleDetector((idleEvent) => {
    mainWindow?.webContents.send('idle-event', idleEvent);
    syncService?.sendIdleEvent(idleEvent);
  });

  activityTracker = new ActivityTracker(
    (activity) => {
      mainWindow?.webContents.send('activity-update', activity);
      syncService?.sendActivityLog(activity);
    },
    syncService.getCategoryRules()
  );

  await syncService.initialize();
  activityTracker.setCategoryRules(syncService.getCategoryRules());
  agentStatus = syncService.getStatus();
  applyManagedState();

  if (watchdogInterval) {
    clearInterval(watchdogInterval);
  }

  watchdogInterval = setInterval(() => {
    void (async () => {
      await syncService?.refreshManagedState();
      if (activityTracker) {
        activityTracker.setCategoryRules(syncService?.getCategoryRules() ?? []);
      }
      applyManagedState();
      await syncService?.syncPendingData();
    })();
  }, 30000);
}

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setName('XEEMS');
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.xa-tech.xeems-desktop');
    }

    Menu.setApplicationMenu(null);

    if (process.platform === 'win32' && !isDev) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: ['--hidden']
      });
    }

    createWindow();
    createTray();
    await initializeServices();

    setupIpcHandlers(ipcMain, {
      getSyncService: () => syncService,
      getAgentStatus: () => getRendererAgentStatus()
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        broadcastAgentStatus();
        return;
      }

      mainWindow?.show();
    });
  });
}

app.on('before-quit', () => {
  allowQuit = true;
  stopMonitoring();
  syncService?.stopAutoSync();

  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }

  tray = null;
});
