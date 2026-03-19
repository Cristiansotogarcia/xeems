import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Image, SafeAreaView, Text, Pressable, View } from 'react-native';
import type { Profile, Shift, ShiftBreak, Site } from '@fieldops/shared';
import { endShiftBreak, getTrackingDiagnostics, prepareShiftTrackingPermissions, startShiftBreak, startShiftTracking, stopShiftTracking } from '../lib/location';
import { supabase } from '../lib/supabase';

interface WorkerState {
  loading: boolean;
  status: string;
  trackingModeLabel: string;
  profile: Profile | null;
  activeShift: Shift | null;
  activeBreak: ShiftBreak | null;
  sites: Site[];
  selectedSiteId: string | null;
}

export default function WorkerScreen() {
  const [state, setState] = useState<WorkerState>({
    loading: true,
    status: 'Loading employee workspace...',
    trackingModeLabel: 'Not started',
    profile: null,
    activeShift: null,
    activeBreak: null,
    sites: [],
    selectedSiteId: null
  });

  async function loadWorkerSnapshot() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        router.replace('/sign-in');
        return;
      }

      const diagnostics = await getTrackingDiagnostics();

      const [
        { data: profile, error: profileError },
        { data: activeShift, error: shiftError },
        { data: activeBreak, error: breakError },
        { data: sites, error: sitesError }
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase
          .from('shifts')
          .select('id, user_id, site_id, status, started_at, ended_at, tracking_mode')
          .eq('user_id', userId)
          .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
          .from('shift_breaks')
          .select('id, shift_id, user_id, break_type, started_at, ended_at')
          .eq('user_id', userId)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('sites')
          .select('id, name, client_name, latitude, longitude, radius_meters, address_line_1, address_line_2, city, region, postal_code, country_code, timezone')
          .eq('is_active', true)
          .order('name')
      ]);

      if (profileError || shiftError || breakError || sitesError) {
        throw profileError ?? shiftError ?? breakError ?? sitesError;
      }

      if (profile?.role === 'admin') {
        await supabase.auth.signOut();
        setState((current: WorkerState) => ({ ...current, loading: false, status: 'Owner/admin accounts are blocked from the employee mobile app.' }));
        return;
      }

      const mappedSites = (sites ?? []).map((site) => ({
        id: site.id,
        name: site.name,
        clientName: site.client_name,
        latitude: site.latitude,
        longitude: site.longitude,
        radiusMeters: site.radius_meters,
        address: {
          line1: site.address_line_1,
          line2: site.address_line_2,
          city: site.city,
          region: site.region,
          postalCode: site.postal_code,
          countryCode: site.country_code,
          timezone: site.timezone
        }
      }));

      setState({
        loading: false,
        status: activeBreak
          ? `${activeBreak.break_type === 'lunch' ? 'Lunch break' : 'Pause'} is active. GPS collection is paused until you end the break.`
          : activeShift
            ? 'Shift is active. Tracking is allowed until you end it.'
            : 'No active shift. GPS collection is off.',
        trackingModeLabel: diagnostics.taskRegistered ? 'Background task registered' : diagnostics.taskDefined ? 'Task available, waiting to register' : 'Task unavailable',
        profile: profile
          ? {
              id: profile.id,
              fullName: profile.full_name?.trim() || profile.email?.trim() || 'Employee',
              role: profile.role,
              isActive: profile.is_active
            }
          : null,
        activeShift: activeShift
          ? {
              id: activeShift.id,
              userId: activeShift.user_id,
              siteId: activeShift.site_id,
              status: activeShift.status,
              startedAt: activeShift.started_at,
              endedAt: activeShift.ended_at,
              trackingMode: activeShift.tracking_mode
            }
          : null,
        activeBreak: activeBreak
          ? {
              id: activeBreak.id,
              shiftId: activeBreak.shift_id,
              userId: activeBreak.user_id,
              breakType: activeBreak.break_type,
              startedAt: activeBreak.started_at,
              endedAt: activeBreak.ended_at
            }
          : null,
        sites: mappedSites,
        selectedSiteId: activeShift?.site_id ?? mappedSites[0]?.id ?? null
      });
    } catch (error) {
      setState((current: WorkerState) => ({
        ...current,
        loading: false,
        activeBreak: current.activeBreak,
        status: error instanceof Error ? error.message : 'Unable to load worker data.'
      }));
    }
  }

  useEffect(() => {
    void loadWorkerSnapshot();
  }, []);

  async function handleStartShift() {
    try {
      setState((current: WorkerState) => ({ ...current, status: 'Requesting device permissions and starting shift tracking...' }));
      await prepareShiftTrackingPermissions();
      const trackingStatus = await startShiftTracking({
        id: state.activeShift?.id ?? 'new',
        userId: state.profile?.id ?? '',
        siteId: state.selectedSiteId,
        status: 'active',
        trackingMode: 'background'
      });
      setState((current) => ({ ...current, status: trackingStatus.lastSyncLabel, trackingModeLabel: trackingStatus.mode }));
      await loadWorkerSnapshot();
    } catch (error) {
      setState((current: WorkerState) => ({ ...current, status: error instanceof Error ? error.message : 'Unable to start shift.' }));
    }
  }

  async function handleEndShift() {
    try {
      setState((current: WorkerState) => ({ ...current, status: 'Ending shift and disabling tracking...' }));
      const trackingStatus = await stopShiftTracking();
      setState((current) => ({ ...current, status: trackingStatus.lastSyncLabel, trackingModeLabel: trackingStatus.mode }));
      await loadWorkerSnapshot();
    } catch (error) {
      setState((current: WorkerState) => ({ ...current, status: error instanceof Error ? error.message : 'Unable to end shift.' }));
    }
  }

  async function handleStartBreak(breakType: 'lunch' | 'pause') {
    try {
      setState((current: WorkerState) => ({
        ...current,
        status: `Starting ${breakType === 'lunch' ? 'lunch break' : 'pause'} and pausing GPS tracking...`
      }));
      const trackingStatus = await startShiftBreak(breakType);
      setState((current) => ({ ...current, status: trackingStatus.lastSyncLabel, trackingModeLabel: trackingStatus.mode }));
      await loadWorkerSnapshot();
    } catch (error) {
      setState((current: WorkerState) => ({ ...current, status: error instanceof Error ? error.message : 'Unable to start break.' }));
    }
  }

  async function handleEndBreak() {
    try {
      setState((current: WorkerState) => ({ ...current, status: 'Ending break and resuming GPS tracking...' }));
      const trackingStatus = await endShiftBreak();
      setState((current) => ({ ...current, status: trackingStatus.lastSyncLabel, trackingModeLabel: trackingStatus.mode }));
      await loadWorkerSnapshot();
    } catch (error) {
      setState((current: WorkerState) => ({ ...current, status: error instanceof Error ? error.message : 'Unable to end break.' }));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f8fb', padding: 20, gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Image source={require('../assets/xeems-logo.png')} style={{ width: 240, height: 76 }} resizeMode="contain" />
        <Text style={{ color: '#10233d', fontSize: 24, fontWeight: '700' }}>Employee shift console</Text>
      </View>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#d6e2ec' }}>
        <Text style={{ color: '#10233d' }}>Signed in as: {state.profile?.fullName ?? 'Unknown employee'}</Text>
        <Text style={{ color: '#10233d' }}>Role: {state.profile?.role ?? 'worker'}</Text>
        <Text style={{ color: '#10233d' }}>Shift status: {state.activeShift?.status ?? 'inactive'}</Text>
        <Text style={{ color: '#10233d' }}>
          Break status: {state.activeBreak ? `${state.activeBreak.breakType} since ${new Date(state.activeBreak.startedAt).toLocaleTimeString()}` : 'none'}
        </Text>
        <Text style={{ color: '#10233d' }}>Tracking status: {state.status}</Text>
        <Text style={{ color: '#10233d' }}>Device tracking mode: {state.trackingModeLabel}</Text>
        <Text style={{ color: '#355372' }}>
          This company phone uses XEEMS under written notification. GPS collection still stays limited to active shifts. Aruba sites default to America/Aruba where no site timezone is set.
        </Text>
      </View>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: '#d6e2ec' }}>
        <Text style={{ color: '#10233d', fontWeight: '700' }}>Shift site</Text>
        {state.sites.length === 0 ? (
          <Text style={{ color: '#5f7288' }}>No active sites loaded yet.</Text>
        ) : (
          state.sites.map((site) => {
            const isSelected = state.selectedSiteId === site.id;
            return (
              <Pressable
                key={site.id}
                onPress={() => setState((current) => ({ ...current, selectedSiteId: site.id }))}
                style={{
                  borderWidth: 1,
                  borderColor: isSelected ? '#1d62d1' : '#c6d5e3',
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: isSelected ? '#e8f1ff' : '#f9fbfd'
                }}
              >
                <Text style={{ color: '#10233d', fontWeight: '700' }}>{site.name}</Text>
                <Text style={{ color: '#355372' }}>{site.clientName ?? 'Unassigned client'}</Text>
                <Text style={{ color: '#5f7288' }}>
                  {site.address?.line1 ?? 'Address missing'} {site.address?.city ? `, ${site.address.city}` : ''}
                </Text>
                <Text style={{ color: '#5f7288' }}>{site.radiusMeters}m geofence</Text>
              </Pressable>
            );
          })
        )}
      </View>
      <View style={{ gap: 12 }}>
        <Pressable onPress={handleStartShift} disabled={state.loading || !!state.activeShift || !state.selectedSiteId} style={{ backgroundColor: '#1d62d1', padding: 16, borderRadius: 14, opacity: state.loading || !!state.activeShift || !state.selectedSiteId ? 0.6 : 1 }}>
          <Text style={{ color: '#ffffff', fontWeight: '700', textAlign: 'center' }}>Start shift tracking</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={() => handleStartBreak('lunch')}
            disabled={state.loading || !state.activeShift || !!state.activeBreak}
            style={{ flex: 1, backgroundColor: '#fff0bf', padding: 16, borderRadius: 14, opacity: state.loading || !state.activeShift || !!state.activeBreak ? 0.6 : 1 }}
          >
            <Text style={{ color: '#78350f', fontWeight: '700', textAlign: 'center' }}>Start lunch break</Text>
          </Pressable>
          <Pressable
            onPress={() => handleStartBreak('pause')}
            disabled={state.loading || !state.activeShift || !!state.activeBreak}
            style={{ flex: 1, backgroundColor: '#ffd6b0', padding: 16, borderRadius: 14, opacity: state.loading || !state.activeShift || !!state.activeBreak ? 0.6 : 1 }}
          >
            <Text style={{ color: '#7c2d12', fontWeight: '700', textAlign: 'center' }}>Start pause</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={handleEndBreak}
          disabled={state.loading || !state.activeBreak}
          style={{ backgroundColor: '#c9f1d8', padding: 16, borderRadius: 14, opacity: state.loading || !state.activeBreak ? 0.6 : 1 }}
        >
          <Text style={{ color: '#14532d', fontWeight: '700', textAlign: 'center' }}>End current break</Text>
        </Pressable>
        <Pressable onPress={handleEndShift} disabled={state.loading || !state.activeShift || !!state.activeBreak} style={{ backgroundColor: '#ffd0d0', padding: 16, borderRadius: 14, opacity: state.loading || !state.activeShift || !!state.activeBreak ? 0.6 : 1 }}>
          <Text style={{ color: '#7f1d1d', fontWeight: '700', textAlign: 'center' }}>End shift and stop tracking</Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#d6e2ec' }}>
        <Text style={{ color: '#10233d', fontWeight: '700' }}>XEEMS notice</Text>
        <Text style={{ color: '#4b5f75' }}>
          Your employer provides written XEEMS notification for company-issued devices. In-app consent capture is not required for this deployment.
        </Text>
      </View>
    </SafeAreaView>
  );
}
