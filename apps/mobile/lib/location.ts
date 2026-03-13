import type { Shift } from '@fieldops/shared';

export interface TrackingStatus {
  enabled: boolean;
  lastSyncLabel: string;
}

export async function requestShiftTrackingConsent() {
  return {
    foreground: 'granted',
    background: 'prompt-on-shift-start'
  } as const;
}

export async function startShiftTracking(_shift: Shift): Promise<TrackingStatus> {
  return {
    enabled: true,
    lastSyncLabel: 'Waiting for first location sync'
  };
}

export async function stopShiftTracking(): Promise<TrackingStatus> {
  return {
    enabled: false,
    lastSyncLabel: 'Tracking stopped'
  };
}
