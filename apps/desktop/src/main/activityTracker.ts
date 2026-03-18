import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';

export type ActivityCategory = 'productive' | 'social_media' | 'neutral' | 'restricted';

export interface CategoryRule {
  pattern: string;
  category: ActivityCategory;
}

export interface ActivityData {
  id: string;
  timestamp: Date;
  appName: string;
  windowTitle: string;
  activityType: 'app_focus' | 'window_change' | 'active';
  isProductive: boolean;
  category: ActivityCategory;
}

const defaultCategoryRules: CategoryRule[] = [
  { pattern: 'code', category: 'productive' },
  { pattern: 'visual studio', category: 'productive' },
  { pattern: 'vs code', category: 'productive' },
  { pattern: 'notepad++', category: 'productive' },
  { pattern: 'sublime', category: 'productive' },
  { pattern: 'terminal', category: 'productive' },
  { pattern: 'powershell', category: 'productive' },
  { pattern: 'cmd', category: 'productive' },
  { pattern: 'excel', category: 'productive' },
  { pattern: 'word', category: 'productive' },
  { pattern: 'outlook', category: 'productive' },
  { pattern: 'teams', category: 'productive' },
  { pattern: 'slack', category: 'productive' },
  { pattern: 'notion', category: 'productive' },
  { pattern: 'obsidian', category: 'productive' },
  { pattern: 'github', category: 'productive' },
  { pattern: 'figma', category: 'productive' },
  { pattern: 'facebook', category: 'social_media' },
  { pattern: 'twitter', category: 'social_media' },
  { pattern: 'x.com', category: 'social_media' },
  { pattern: 'instagram', category: 'social_media' },
  { pattern: 'tiktok', category: 'social_media' },
  { pattern: 'youtube', category: 'social_media' },
  { pattern: 'reddit', category: 'social_media' },
  { pattern: 'discord', category: 'social_media' },
  { pattern: 'whatsapp', category: 'social_media' },
  { pattern: 'telegram', category: 'social_media' },
  { pattern: 'linkedin', category: 'social_media' },
  { pattern: 'torrent', category: 'restricted' },
  { pattern: 'utorrent', category: 'restricted' },
  { pattern: 'spotify', category: 'restricted' }
];

type GetWindowsModule = {
  activeWindow: () => Promise<{
    title?: string;
    owner?: {
      name?: string;
      processId?: number;
      path?: string;
    };
  } | undefined>;
};

const importEsmModule = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<GetWindowsModule>;

export class ActivityTracker {
  private intervalId: NodeJS.Timeout | null = null;
  private callback: (activity: ActivityData) => void;
  private pollInterval = 5000;
  private lastActivity: Pick<ActivityData, 'appName' | 'windowTitle'> | null = null;
  private isRunning = false;
  private categoryRules: CategoryRule[];
  private getWindowsModulePromise: Promise<GetWindowsModule> | null = null;

  constructor(callback: (activity: ActivityData) => void, initialRules: CategoryRule[] = defaultCategoryRules) {
    this.callback = callback;
    this.categoryRules = initialRules.length > 0 ? initialRules : defaultCategoryRules;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    log.info('Starting activity tracker...');
    this.isRunning = true;
    void this.checkActivity();
    this.intervalId = setInterval(() => {
      void this.checkActivity();
    }, this.pollInterval);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    log.info('Stopping activity tracker...');
    this.isRunning = false;
    this.lastActivity = null;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  setPollInterval(ms: number): void {
    this.pollInterval = ms;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  setCategoryRules(rules: CategoryRule[]): void {
    if (rules.length === 0) {
      return;
    }

    this.categoryRules = rules;
  }

  getCategoryRules(): CategoryRule[] {
    return this.categoryRules;
  }

  private async getWindowsModule() {
    if (!this.getWindowsModulePromise) {
      this.getWindowsModulePromise = importEsmModule('get-windows');
    }

    return this.getWindowsModulePromise;
  }

  private async checkActivity(): Promise<void> {
    try {
      const getWindows = await this.getWindowsModule();
      const result = await getWindows.activeWindow();

      if (!result?.owner?.name) {
        return;
      }

      const appName = result.owner.name;
      const windowTitle = result.title ?? '';
      const searchText = `${appName} ${windowTitle}`.toLowerCase();
      const category = this.categorizeActivity(searchText);
      const isProductive = category === 'productive';
      const changed =
        !this.lastActivity ||
        this.lastActivity.appName !== appName ||
        this.lastActivity.windowTitle !== windowTitle;

      const activity: ActivityData = {
        id: uuidv4(),
        timestamp: new Date(),
        appName,
        windowTitle,
        activityType: changed ? 'app_focus' : 'active',
        isProductive,
        category
      };

      this.lastActivity = {
        appName,
        windowTitle
      };

      this.callback(activity);
    } catch (error) {
      log.error('Error checking active window:', error);
    }
  }

  private categorizeActivity(value: string): ActivityCategory {
    for (const rule of this.categoryRules) {
      if (value.includes(rule.pattern.toLowerCase())) {
        return rule.category;
      }
    }

    return 'neutral';
  }
}
