export type UserRole = 'worker' | 'admin';
export type ShiftStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type TrackingMode = 'foreground' | 'background';
export type GeofenceEventType = 'enter' | 'exit' | 'dwell';

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface Site {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface Shift {
  id: string;
  userId: string;
  siteId?: string;
  status: ShiftStatus;
  startedAt?: string;
  endedAt?: string;
  trackingMode?: TrackingMode;
}

export interface LocationPing {
  id: string;
  shiftId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
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

export const CONSENT_VERSION = 'v1';
export const DEFAULT_LOCATION_BATCH_SECONDS = 60;
export const DEFAULT_GEOFENCE_DWELL_SECONDS = 120;
