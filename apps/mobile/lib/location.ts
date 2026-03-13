import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONSENT_VERSION,
  DEFAULT_LOCATION_BATCH_SECONDS,
  DEFAULT_SITE_TIMEZONE,
  type Shift
} from '@fieldops/shared';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const LOCATION_TASK_NAME = 'fieldops-active-shift-location';
const ACTIVE_SHIFT_STORAGE_KEY = 'fieldops.activeShift';

interface StoredShiftContext {
  shiftId: string;
  userId: string;
}

export interface TrackingStatus {
  enabled: boolean;
  lastSyncLabel: string;
  mode: 'background' | 'foreground-fallback' | 'stopped';
}

export interface TrackingDiagnostics {
  taskDefined: boolean;
  taskRegistered: boolean;
  platform: string;
  activeShiftId: string | null;
}

async function readStoredShiftContext(): Promise<StoredShiftContext | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SHIFT_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredShiftContext;
  } catch {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_STORAGE_KEY);
    return null;
  }
}

async function writeStoredShiftContext(context: StoredShiftContext | null) {
  if (!context) {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(ACTIVE_SHIFT_STORAGE_KEY, JSON.stringify(context));
}

async function insertLocationPing(context: StoredShiftContext, location: Location.LocationObject, source: 'foreground' | 'background' | 'manual') {
  const { error } = await supabase.from('location_pings').insert({
    shift_id: context.shiftId,
    user_id: context.userId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy_meters: location.coords.accuracy ?? null,
    speed_mps: location.coords.speed ?? null,
    captured_at: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
    source
  });

  if (error) {
    throw error;
  }
}

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Location task failed', error);
      return;
    }

    try {
      const context = await readStoredShiftContext();
      if (!context) {
        return;
      }

      const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
      for (const location of locations) {
        await insertLocationPing(context, location, 'background');
      }
    } catch (taskError) {
      console.error('Unable to sync background location', taskError);
    }
  });
}

async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Foreground location permission is required to track an active shift.');
  }

  const background = await Location.requestBackgroundPermissionsAsync();

  return {
    foreground: foreground.status,
    background: background.status
  } as const;
}

async function fetchActiveShiftContext() {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    throw new Error('Sign in before starting a shift.');
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .select('id, user_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw error;
  }

  return {
    shiftId: shift.id as string,
    userId: shift.user_id as string
  } satisfies StoredShiftContext;
}

async function syncImmediateLocationPing(source: 'foreground' | 'manual' = 'foreground') {
  const context = await readStoredShiftContext();
  if (!context) {
    return;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  await insertLocationPing(context, location, source);
}

async function startExpoBackgroundUpdates() {
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: DEFAULT_LOCATION_BATCH_SECONDS * 1000,
    distanceInterval: 50,
    deferredUpdatesInterval: DEFAULT_LOCATION_BATCH_SECONDS * 1000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.Other,
    foregroundService: {
      notificationTitle: 'Shift tracking active',
      notificationBody: 'FieldOps is collecting location only while your shift is active.',
      notificationColor: '#0ea5e9'
    }
  });
}

export async function requestShiftTrackingConsent() {
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;

  if (!userId) {
    throw new Error('Sign in before requesting tracking consent.');
  }

  const permissions = await requestLocationPermissions();

  const { error } = await supabase.from('consent_records').insert({
    user_id: userId,
    consent_version: CONSENT_VERSION,
    permission_scope: 'foreground_and_background_active_shift_only',
    device_platform: `expo-${Platform.OS}`
  });

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    throw error;
  }

  return permissions;
}

export async function startShiftTracking(shift: Shift): Promise<TrackingStatus> {
  const { error } = await supabase.rpc('start_shift', {
    p_site_id: shift.siteId ?? null,
    p_tracking_mode: shift.trackingMode ?? 'background'
  });

  if (error) {
    throw error;
  }

  const context = await fetchActiveShiftContext();
  await writeStoredShiftContext(context);

  try {
    await startExpoBackgroundUpdates();
    await syncImmediateLocationPing('foreground');

    return {
      enabled: true,
      mode: 'background',
      lastSyncLabel: `Shift started. Background tracking is registered for the active shift only (${DEFAULT_SITE_TIMEZONE} default site timezone context).`
    };
  } catch (trackingError) {
    await syncImmediateLocationPing('manual');

    return {
      enabled: true,
      mode: 'foreground-fallback',
      lastSyncLabel:
        trackingError instanceof Error
          ? `Shift started, but background tracking fell back to manual/foreground sync: ${trackingError.message}`
          : 'Shift started, but background tracking fell back to manual/foreground sync.'
    };
  }
}

export async function stopShiftTracking(): Promise<TrackingStatus> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await writeStoredShiftContext(null);

  const { error } = await supabase.rpc('end_my_active_shift');

  if (error) {
    throw error;
  }

  return {
    enabled: false,
    mode: 'stopped',
    lastSyncLabel: 'Shift ended. GPS collection should now stop immediately.'
  };
}

export async function getTrackingDiagnostics(): Promise<TrackingDiagnostics> {
  const context = await readStoredShiftContext();

  return {
    taskDefined: TaskManager.isTaskDefined(LOCATION_TASK_NAME),
    taskRegistered: await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME),
    platform: Platform.OS,
    activeShiftId: context?.shiftId ?? null
  };
}

export async function resumeShiftTrackingIfNeeded() {
  const context = await readStoredShiftContext();
  if (!context) return;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) return;

  const { data: activeShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('id', context.shiftId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!activeShift) {
    await writeStoredShiftContext(null);
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    return;
  }

  if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME))) {
    try {
      await startExpoBackgroundUpdates();
    } catch {
      // Silent fallback: keep existing shift active and allow manual sync via button/refresh states.
    }
  }
}
