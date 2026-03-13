import { CONSENT_VERSION, type Shift } from '@fieldops/shared';
import { supabase } from './supabase';

export interface TrackingStatus {
  enabled: boolean;
  lastSyncLabel: string;
}

export async function requestShiftTrackingConsent() {
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;

  if (!userId) {
    throw new Error('Sign in before requesting tracking consent.');
  }

  const { error } = await supabase.from('consent_records').insert({
    user_id: userId,
    consent_version: CONSENT_VERSION,
    permission_scope: 'foreground_and_background_active_shift_only',
    device_platform: 'expo'
  });

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    throw error;
  }

  return {
    foreground: 'granted',
    background: 'prompt-on-shift-start'
  } as const;
}

export async function startShiftTracking(shift: Shift): Promise<TrackingStatus> {
  const { error } = await supabase.rpc('start_shift', {
    p_site_id: shift.siteId ?? null,
    p_tracking_mode: shift.trackingMode ?? 'background'
  });

  if (error) {
    throw error;
  }

  return {
    enabled: true,
    lastSyncLabel: 'Shift started. GPS collection is allowed until you end the shift.'
  };
}

export async function stopShiftTracking(): Promise<TrackingStatus> {
  const { error } = await supabase.rpc('end_my_active_shift');

  if (error) {
    throw error;
  }

  return {
    enabled: false,
    lastSyncLabel: 'Shift ended. GPS collection should now stop.'
  };
}
