import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, Text, Pressable, View } from 'react-native';
import type { ConsentRecord, Profile, Shift, Site } from '@fieldops/shared';
import { requestShiftTrackingConsent, startShiftTracking, stopShiftTracking } from '../lib/location';
import { supabase } from '../lib/supabase';

interface WorkerState {
  loading: boolean;
  status: string;
  profile: Profile | null;
  activeShift: Shift | null;
  sites: Site[];
  consents: ConsentRecord[];
}

export default function WorkerScreen() {
  const [state, setState] = useState<WorkerState>({
    loading: true,
    status: 'Loading employee workspace...',
    profile: null,
    activeShift: null,
    sites: [],
    consents: []
  });

  async function loadWorkerSnapshot() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        router.replace('/sign-in');
        return;
      }

      const [{ data: profile, error: profileError }, { data: activeShift, error: shiftError }, { data: sites, error: sitesError }, { data: consents, error: consentError }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, is_active').eq('id', userId).single(),
        supabase
          .from('shifts')
          .select('id, user_id, site_id, status, started_at, ended_at, tracking_mode')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('sites').select('id, name, latitude, longitude, radius_meters').eq('is_active', true).order('name'),
        supabase.from('consent_records').select('id, user_id, consent_version, consented_at, permission_scope').eq('user_id', userId).order('consented_at', { ascending: false }).limit(3)
      ]);

      if (profileError || shiftError || sitesError || consentError) {
        throw profileError ?? shiftError ?? sitesError ?? consentError;
      }

      if (profile?.role === 'admin') {
        await supabase.auth.signOut();
        setState((current: WorkerState) => ({ ...current, loading: false, status: 'Owner/admin accounts are blocked from the employee mobile app.' }));
        return;
      }

      setState({
        loading: false,
        status: activeShift ? 'Shift is active. Tracking may run until you end it.' : 'No active shift. GPS collection is off.',
        profile: profile
          ? {
              id: profile.id,
              fullName: profile.full_name,
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
        sites: (sites ?? []).map((site) => ({
          id: site.id,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
          radiusMeters: site.radius_meters
        })),
        consents: (consents ?? []).map((consent) => ({
          id: consent.id,
          userId: consent.user_id,
          consentVersion: consent.consent_version,
          consentedAt: consent.consented_at,
          permissionScope: consent.permission_scope
        }))
      });
    } catch (error) {
      setState((current: WorkerState) => ({
        ...current,
        loading: false,
        status: error instanceof Error ? error.message : 'Unable to load worker data.'
      }));
    }
  }

  useEffect(() => {
    void loadWorkerSnapshot();
  }, []);

  async function handleStartShift() {
    try {
      setState((current: WorkerState) => ({ ...current, status: 'Recording consent and starting shift...' }));
      await requestShiftTrackingConsent();
      await startShiftTracking({
        id: state.activeShift?.id ?? 'new',
        userId: state.profile?.id ?? '',
        siteId: state.sites[0]?.id ?? null,
        status: 'active',
        trackingMode: 'background'
      });
      await loadWorkerSnapshot();
    } catch (error) {
      setState((current: WorkerState) => ({ ...current, status: error instanceof Error ? error.message : 'Unable to start shift.' }));
    }
  }

  async function handleEndShift() {
    try {
      setState((current: WorkerState) => ({ ...current, status: 'Ending shift and disabling tracking...' }));
      await stopShiftTracking();
      await loadWorkerSnapshot();
    } catch (error) {
      setState((current: WorkerState) => ({ ...current, status: error instanceof Error ? error.message : 'Unable to end shift.' }));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, gap: 18 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Employee shift console</Text>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: '#e5e7eb' }}>Signed in as: {state.profile?.fullName ?? 'Unknown employee'}</Text>
        <Text style={{ color: '#e5e7eb' }}>Role: {state.profile?.role ?? 'worker'}</Text>
        <Text style={{ color: '#e5e7eb' }}>Shift status: {state.activeShift?.status ?? 'inactive'}</Text>
        <Text style={{ color: '#e5e7eb' }}>Tracking status: {state.status}</Text>
        <Text style={{ color: '#93c5fd' }}>
          Tracking is only allowed after consent and only while your shift is active.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <Pressable onPress={handleStartShift} disabled={state.loading || !!state.activeShift} style={{ backgroundColor: '#0ea5e9', padding: 16, borderRadius: 12, opacity: state.loading || !!state.activeShift ? 0.6 : 1 }}>
          <Text style={{ color: '#082f49', fontWeight: '700', textAlign: 'center' }}>Start shift and enable tracking</Text>
        </Pressable>
        <Pressable onPress={handleEndShift} disabled={state.loading || !state.activeShift} style={{ backgroundColor: '#fca5a5', padding: 16, borderRadius: 12, opacity: state.loading || !state.activeShift ? 0.6 : 1 }}>
          <Text style={{ color: '#7f1d1d', fontWeight: '700', textAlign: 'center' }}>End shift and stop tracking</Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Available sites</Text>
        {state.sites.length === 0 ? (
          <Text style={{ color: '#d1d5db' }}>No active sites loaded yet.</Text>
        ) : (
          state.sites.map((site) => (
            <Text key={site.id} style={{ color: '#d1d5db' }}>
              {site.name} — {site.radiusMeters}m geofence
            </Text>
          ))
        )}
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Recent consent records</Text>
        {state.consents.length === 0 ? (
          <Text style={{ color: '#d1d5db' }}>No consent record stored yet for this account.</Text>
        ) : (
          state.consents.map((consent) => (
            <Text key={consent.id} style={{ color: '#d1d5db' }}>
              {consent.consentedAt} — {consent.permissionScope}
            </Text>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}
