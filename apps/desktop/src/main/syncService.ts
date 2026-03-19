import { app, safeStorage } from 'electron';
import log from 'electron-log';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Store from 'electron-store';
import { ActivityData, CategoryRule } from './activityTracker';
import { IdleEvent } from './idleDetector';

interface WorkerProfileRow {
  id: string;
  email: string | null;
  full_name?: string | null;
  role: 'worker' | 'admin';
  is_active: boolean;
}

interface DesktopDeviceRow {
  id: string;
  user_id: string;
  device_uuid: string;
  device_name: string | null;
  os_username: string | null;
  app_version: string | null;
  enrollment_status: 'pending' | 'enrolled' | 'disabled';
  monitoring_enabled: boolean;
  last_seen_at: string | null;
}

interface ActivityUploadEntry {
  user_id: string;
  device_id: string;
  device_type: 'laptop';
  timestamp: string;
  activity_type: ActivityData['activityType'];
  app_name: string;
  window_title: string;
  duration_seconds: number;
  is_productive: boolean;
  metadata: {
    category: string;
    activity_id: string;
  };
}

interface IdleUploadEntry {
  user_id: string;
  device_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
}

interface DesktopDeviceInsert {
  user_id: string;
  device_uuid: string;
  device_name: string | null;
  os_username: string | null;
  app_version: string | null;
  enrollment_status: DesktopDeviceRow['enrollment_status'];
  monitoring_enabled: boolean;
  last_seen_at: string;
  updated_at: string;
}

interface AppCategoryRow {
  app_name_pattern: string | null;
  category: string | null;
}

interface DesktopDatabase {
  public: {
    Tables: {
      activity_logs: {
        Row: ActivityUploadEntry & { id: string };
        Insert: ActivityUploadEntry;
        Update: Partial<ActivityUploadEntry>;
        Relationships: [];
      };
      app_categories: {
        Row: AppCategoryRow;
        Insert: AppCategoryRow;
        Update: Partial<AppCategoryRow>;
        Relationships: [];
      };
      desktop_devices: {
        Row: DesktopDeviceRow;
        Insert: DesktopDeviceInsert;
        Update: Partial<DesktopDeviceInsert>;
        Relationships: [];
      };
      idle_events: {
        Row: IdleUploadEntry & { id: string };
        Insert: IdleUploadEntry;
        Update: Partial<IdleUploadEntry>;
        Relationships: [];
      };
      profiles: {
        Row: WorkerProfileRow;
        Insert: Partial<WorkerProfileRow>;
        Update: Partial<WorkerProfileRow>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

export interface ManagedAgentStatus {
  signedIn: boolean;
  requiresLogin: boolean;
  enrolled: boolean;
  monitoringAllowed: boolean;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  deviceId: string | null;
  deviceUuid: string;
  deviceName: string | null;
  lastSeenAt: string | null;
  agentMessage: string;
}

type StatusListener = (status: ManagedAgentStatus) => void;

const ACTIVITY_POLL_SECONDS = 5;
const CATEGORY_CACHE_KEY = 'appCategories';
const DEVICE_UUID_KEY = 'deviceUuid';
const DEVICE_ID_KEY = 'deviceId';
const AUTH_STORAGE_KEY_PREFIX = 'auth.';

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
  { pattern: 'figma', category: 'productive' },
  { pattern: 'github', category: 'productive' },
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

function getProfileName(profile: WorkerProfileRow | null | undefined) {
  const fullName = profile?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const email = profile?.email?.trim();
  if (email) {
    return email;
  }

  return 'Employee';
}

export class SyncService {
  private supabase: SupabaseClient<DesktopDatabase> | null = null;
  private store: Store;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingActivities: ActivityUploadEntry[] = [];
  private pendingIdleEvents: IdleUploadEntry[] = [];
  private isOnline = true;
  private user: { id: string; email: string | null } | null = null;
  private profile: WorkerProfileRow | null = null;
  private deviceUuid: string;
  private deviceId: string | null = null;
  private categoryRules: CategoryRule[] = defaultCategoryRules;
  private status: ManagedAgentStatus;
  private statusListener: StatusListener | null;

  constructor(statusListener?: StatusListener) {
    this.store = new Store({ name: 'xeems-config' });
    this.statusListener = statusListener ?? null;
    this.deviceUuid = this.loadDeviceUuid();
    this.deviceId = (this.store.get(DEVICE_ID_KEY) as string | undefined) ?? null;
    this.categoryRules = this.loadCachedCategoryRules();
    this.status = {
      signedIn: false,
      requiresLogin: true,
      enrolled: false,
      monitoringAllowed: false,
      userId: null,
      userName: null,
      userEmail: null,
      deviceId: this.deviceId,
      deviceUuid: this.deviceUuid,
      deviceName: os.hostname(),
      lastSeenAt: null,
      agentMessage: 'Sign in once to enroll this company-owned laptop.'
    };

    this.initializeSupabase();
  }

  private initializeSupabase(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      log.warn('Supabase credentials not configured');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: this.createEncryptedStorage()
      }
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      void this.handleSessionChange(session?.user?.id ?? null, session?.user?.email ?? null);
    });
    this.supabase.auth.startAutoRefresh();
    log.info('Supabase client initialized');
  }

  async initialize(): Promise<void> {
    if (!this.supabase) {
      this.notifyStatus();
      return;
    }

    const {
      data: { session }
    } = await this.supabase.auth.getSession();

    await this.handleSessionChange(session?.user?.id ?? null, session?.user?.email ?? null);
    await this.loadAppCategories();

    if (session?.user?.id) {
      await this.refreshManagedState();
    } else {
      this.updateStatus({
        signedIn: false,
        requiresLogin: true,
        enrolled: false,
        monitoringAllowed: false,
        userId: null,
        userName: null,
        userEmail: null,
        deviceId: null,
        lastSeenAt: null,
        agentMessage: 'Sign in once to enroll this company-owned laptop.'
      });
    }

    this.startAutoSync();
  }

  async login(email: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { success: false, error: error?.message || 'Login failed' };
    }

    try {
      const profile = await this.fetchWorkerProfile(data.user.id);
      if (profile.role !== 'worker') {
        await this.supabase.auth.signOut();
        return { success: false, error: 'Owner/admin accounts must use the web dashboard.' };
      }

      if (!profile.is_active) {
        await this.supabase.auth.signOut();
        return { success: false, error: 'This employee account has been disabled by an administrator.' };
      }

      await this.loadAppCategories();
      await this.refreshManagedState();
      return { success: true, userId: data.user.id };
    } catch (loginError) {
      await this.supabase.auth.signOut();
      return {
        success: false,
        error: loginError instanceof Error ? loginError.message : 'Unable to enroll this device.'
      };
    }
  }

  async refreshManagedState(): Promise<ManagedAgentStatus> {
    if (!this.supabase || !this.user?.id) {
      return this.status;
    }

    try {
      const profile = await this.fetchWorkerProfile(this.user.id);
      this.profile = profile;

      if (profile.role !== 'worker') {
        await this.supabase.auth.signOut();
        this.updateStatus({
          signedIn: false,
          requiresLogin: true,
          enrolled: false,
          monitoringAllowed: false,
          userId: null,
          userName: null,
          userEmail: null,
          deviceId: null,
          lastSeenAt: null,
          agentMessage: 'Owner/admin accounts must use the web dashboard.'
        });
        return this.status;
      }

      if (!profile.is_active) {
        this.updateStatus({
          signedIn: true,
          requiresLogin: false,
          enrolled: false,
          monitoringAllowed: false,
          userId: profile.id,
          userName: getProfileName(profile),
          userEmail: profile.email,
          deviceId: null,
          lastSeenAt: null,
          agentMessage: 'This employee account has been disabled by an administrator.'
        });
        return this.status;
      }

      const device = await this.upsertOrLoadDevice(profile.id);
      if (!device) {
        this.updateStatus({
          signedIn: true,
          requiresLogin: false,
          enrolled: false,
          monitoringAllowed: false,
          userId: profile.id,
          userName: getProfileName(profile),
          userEmail: profile.email,
          deviceId: null,
          lastSeenAt: null,
          agentMessage: 'Unable to enroll this company laptop.'
        });
        return this.status;
      }

      this.deviceId = device.id;
      this.store.set(DEVICE_ID_KEY, device.id);

      const monitoringAllowed = device.monitoring_enabled && device.enrollment_status === 'enrolled';
      this.updateStatus({
        signedIn: true,
        requiresLogin: false,
        enrolled: true,
        monitoringAllowed,
        userId: profile.id,
        userName: getProfileName(profile),
        userEmail: profile.email,
        deviceId: device.id,
        deviceName: device.device_name ?? os.hostname(),
        lastSeenAt: device.last_seen_at,
        agentMessage: monitoringAllowed
          ? 'XEEMS Desktop is enrolled and should remain active on this company laptop.'
          : 'Monitoring is disabled for this device by an administrator.'
      });
    } catch (error) {
      log.error('Failed to refresh managed state:', error);
      this.updateStatus({
        monitoringAllowed: false,
        enrolled: false,
        deviceId: null,
        lastSeenAt: null,
        agentMessage: error instanceof Error ? error.message : 'Unable to validate device enrollment.'
      });
    }

    return this.status;
  }

  getStatus(): ManagedAgentStatus {
    return { ...this.status };
  }

  getCategoryRules(): CategoryRule[] {
    return [...this.categoryRules];
  }

  sendActivityLog(activity: ActivityData): void {
    if (!this.canCapture()) {
      return;
    }

    const entry: ActivityUploadEntry = {
      user_id: this.user!.id,
      device_id: this.deviceId!,
      device_type: 'laptop',
      timestamp: activity.timestamp.toISOString(),
      activity_type: activity.activityType,
      app_name: activity.appName,
      window_title: activity.windowTitle,
      duration_seconds: ACTIVITY_POLL_SECONDS,
      is_productive: activity.isProductive,
      metadata: {
        category: activity.category,
        activity_id: activity.id
      }
    };

    if (this.supabase && this.isOnline) {
      void this.uploadActivityLog(entry).catch((error) => {
        log.error('Failed to upload activity log:', error);
        this.pendingActivities.push(entry);
      });
      return;
    }

    this.pendingActivities.push(entry);
  }

  sendIdleEvent(idleEvent: IdleEvent): void {
    if (!this.canCapture()) {
      return;
    }

    const entry: IdleUploadEntry = {
      user_id: this.user!.id,
      device_id: this.deviceId!,
      start_time: idleEvent.startTime.toISOString(),
      end_time: idleEvent.endTime?.toISOString() ?? null,
      duration_seconds: idleEvent.durationSeconds
    };

    if (this.supabase && this.isOnline) {
      void this.uploadIdleEvent(entry).catch((error) => {
        log.error('Failed to upload idle event:', error);
        this.pendingIdleEvents.push(entry);
      });
      return;
    }

    this.pendingIdleEvents.push(entry);
  }

  async syncPendingData(): Promise<void> {
    if (!this.supabase || !this.isOnline) {
      return;
    }

    await this.refreshManagedState();
    if (!this.canCapture()) {
      return;
    }

    if (this.pendingActivities.length > 0) {
      const entries = [...this.pendingActivities];
      this.pendingActivities = [];
      for (const entry of entries) {
        try {
          await this.uploadActivityLog(entry);
        } catch (error) {
          log.error('Failed to sync pending activity:', error);
          this.pendingActivities.push(entry);
        }
      }
    }

    if (this.pendingIdleEvents.length > 0) {
      const entries = [...this.pendingIdleEvents];
      this.pendingIdleEvents = [];
      for (const entry of entries) {
        try {
          await this.uploadIdleEvent(entry);
        } catch (error) {
          log.error('Failed to sync pending idle event:', error);
          this.pendingIdleEvents.push(entry);
        }
      }
    }
  }

  startAutoSync(intervalMs = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      void this.syncPendingData();
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    if (online) {
      void this.syncPendingData();
    }
  }

  isConfigured(): boolean {
    return this.status.signedIn && this.status.enrolled && !!this.deviceId;
  }

  hasSupabase(): boolean {
    return this.supabase !== null;
  }

  shouldMonitor(): boolean {
    return this.status.monitoringAllowed && this.status.enrolled && !!this.deviceId && !!this.user?.id;
  }

  private canCapture(): boolean {
    return this.shouldMonitor();
  }

  private async uploadActivityLog(entry: ActivityUploadEntry): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await (this.supabase.from('activity_logs') as any).insert(entry);
    if (error) {
      throw error;
    }
  }

  private async uploadIdleEvent(entry: IdleUploadEntry): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await (this.supabase.from('idle_events') as any).insert(entry);
    if (error) {
      throw error;
    }
  }

  private async fetchWorkerProfile(userId: string): Promise<WorkerProfileRow> {
    if (!this.supabase) {
      throw new Error('Supabase is not initialized.');
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw error ?? new Error('Unable to load employee profile.');
    }

    return data as WorkerProfileRow;
  }

  private async upsertOrLoadDevice(userId: string): Promise<DesktopDeviceRow | null> {
    if (!this.supabase) {
      return null;
    }

    const payload: DesktopDeviceInsert = {
      user_id: userId,
      device_uuid: this.deviceUuid,
      device_name: os.hostname(),
      os_username: os.userInfo().username,
      app_version: app.getVersion(),
      enrollment_status: 'enrolled',
      monitoring_enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await (this.supabase
      .from('desktop_devices') as any)
      .upsert(payload, { onConflict: 'device_uuid' })
      .select('id, user_id, device_uuid, device_name, os_username, app_version, enrollment_status, monitoring_enabled, last_seen_at')
      .maybeSingle();

    if (!error && data) {
      return data as DesktopDeviceRow;
    }

    const lookup = await this.supabase
      .from('desktop_devices')
      .select('id, user_id, device_uuid, device_name, os_username, app_version, enrollment_status, monitoring_enabled, last_seen_at')
      .eq('device_uuid', this.deviceUuid)
      .maybeSingle();

    if (lookup.error) {
      throw error ?? lookup.error;
    }

    return (lookup.data as DesktopDeviceRow | null) ?? null;
  }

  private async loadAppCategories(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { data, error } = await this.supabase
      .from('app_categories')
      .select('app_name_pattern, category')
      .order('app_name_pattern');

    if (error) {
      log.warn('Unable to load remote app categories:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    const mappedRules = (data as AppCategoryRow[])
      .map((entry) => {
        if (!entry.app_name_pattern || !entry.category) {
          return null;
        }

        return {
          pattern: String(entry.app_name_pattern),
          category: String(entry.category) as CategoryRule['category']
        };
      })
      .filter((entry): entry is CategoryRule => entry !== null);

    if (mappedRules.length === 0) {
      return;
    }

    this.categoryRules = mappedRules;
    this.store.set(CATEGORY_CACHE_KEY, mappedRules);
  }

  private loadCachedCategoryRules(): CategoryRule[] {
    const cached = this.store.get(CATEGORY_CACHE_KEY) as CategoryRule[] | undefined;
    return cached && cached.length > 0 ? cached : defaultCategoryRules;
  }

  private loadDeviceUuid(): string {
    const existing = this.store.get(DEVICE_UUID_KEY) as string | undefined;
    if (existing) {
      return existing;
    }

    const nextValue = uuidv4();
    this.store.set(DEVICE_UUID_KEY, nextValue);
    return nextValue;
  }

  private createEncryptedStorage() {
    return {
      getItem: (key: string) => {
        const stored = this.store.get(`${AUTH_STORAGE_KEY_PREFIX}${key}`) as string | undefined;
        if (!stored) {
          return null;
        }

        return this.decrypt(stored);
      },
      setItem: (key: string, value: string) => {
        this.store.set(`${AUTH_STORAGE_KEY_PREFIX}${key}`, this.encrypt(value));
      },
      removeItem: (key: string) => {
        this.store.delete(`${AUTH_STORAGE_KEY_PREFIX}${key}`);
      }
    };
  }

  private encrypt(value: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value).toString('base64');
    }

    return value;
  }

  private decrypt(value: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(value, 'base64'));
      } catch {
        return value;
      }
    }

    return value;
  }

  private async handleSessionChange(userId: string | null, email: string | null): Promise<void> {
    if (!userId) {
      this.user = null;
      this.profile = null;
      this.deviceId = null;
      this.store.delete(DEVICE_ID_KEY);
      this.updateStatus({
        signedIn: false,
        requiresLogin: true,
        enrolled: false,
        monitoringAllowed: false,
        userId: null,
        userName: null,
        userEmail: null,
        deviceId: null,
        lastSeenAt: null,
        agentMessage: 'Sign in once to enroll this company-owned laptop.'
      });
      return;
    }

    this.user = { id: userId, email };
    this.updateStatus({
      signedIn: true,
      requiresLogin: false,
      userId,
      userEmail: email
    });
  }

  private updateStatus(patch: Partial<ManagedAgentStatus>): void {
    this.status = {
      ...this.status,
      ...patch
    };
    this.notifyStatus();
  }

  private notifyStatus(): void {
    this.statusListener?.({ ...this.status });
  }
}
