export type UserRole = 'worker' | 'admin';
export type ShiftStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type TrackingMode = 'foreground' | 'background';
export type GeofenceEventType = 'enter' | 'exit' | 'dwell';

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export interface SiteAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
}

export interface Site {
  id: string;
  name: string;
  clientName?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address?: SiteAddress;
  isActive?: boolean;
  createdAt?: string;
}

export interface Shift {
  id: string;
  userId: string;
  siteId?: string | null;
  status: ShiftStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  trackingMode?: TrackingMode | null;
}

export interface LocationPing {
  id: string;
  shiftId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
  source: TrackingMode | 'manual';
}

export interface GeofenceEvent {
  id: string;
  shiftId: string;
  userId: string;
  siteId: string;
  eventType: GeofenceEventType;
  eventAt: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentVersion: string;
  consentedAt: string;
  permissionScope: string;
}

export interface WorkerAppSnapshot {
  profile: Profile;
  activeShift: Shift | null;
  recentConsents: ConsentRecord[];
  availableSites: Site[];
}

export interface AdminDashboardSnapshot {
  adminProfile: Profile;
  activeShifts: Array<Shift & { profile?: Pick<Profile, 'fullName'> | null; site?: Pick<Site, 'name'> | null }>;
  sites: Site[];
  recentEvents: Array<GeofenceEvent & { site?: Pick<Site, 'name'> | null; profile?: Pick<Profile, 'fullName'> | null }>;
}

export interface SupabasePublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const SUPABASE_PROJECT_ID = 'gfvxqomihlolxhfigebk';
export const SUPABASE_PROJECT_NAME = 'GPS Monitoring';
export const DEFAULT_SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const CONSENT_VERSION = 'v1';
export const DEFAULT_LOCATION_BATCH_SECONDS = 60;
export const DEFAULT_GEOFENCE_DWELL_SECONDS = 120;
export const DEFAULT_SHIFT_AUTO_STOP_HOURS = 16;
export const DEFAULT_SITE_TIMEZONE = 'America/Aruba';

export function isAdminRole(role?: UserRole | null): role is 'admin' {
  return role === 'admin';
}

export function getRequiredEnv(key: string, value?: string | null) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getSupabaseUrlFromProjectId(projectId = SUPABASE_PROJECT_ID) {
  return `https://${projectId}.supabase.co`;
}

export function formatSiteAddress(address?: SiteAddress) {
  if (!address) {
    return '';
  }

  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.countryCode]
    .filter(Boolean)
    .join(', ');
}
