'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface DashboardState {
  loading: boolean;
  error: string | null;
  adminName: string;
  activeShifts: Array<{ id: string; workerName: string; siteName: string; startedAt: string }>;
  recentEvents: Array<{ id: string; at: string; label: string }>;
  sites: Array<{ id: string; name: string; radius: number }>;
}

interface ActiveShiftRow {
  id: string;
  started_at: string | null;
  profiles: Array<{ full_name: string | null }> | null;
  sites: Array<{ name: string | null }> | null;
}

interface EventRow {
  id: string;
  event_at: string;
  event_type: string;
  profiles: Array<{ full_name: string | null }> | null;
  sites: Array<{ name: string | null }> | null;
}

interface SiteRow {
  id: string;
  name: string;
  radius_meters: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    adminName: '',
    activeShifts: [],
    recentEvents: [],
    sites: []
  });

  async function loadDashboard() {
    try {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (profile.role !== 'admin') {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      const [{ data: activeShifts, error: shiftsError }, { data: recentEvents, error: eventsError }, { data: sites, error: sitesError }] = await Promise.all([
        supabase
          .from('shifts')
          .select('id, started_at, profiles:profiles!shifts_user_id_fkey(full_name), sites(name)')
          .eq('status', 'active')
          .order('started_at', { ascending: false }),
        supabase
          .from('geofence_events')
          .select('id, event_at, event_type, profiles:profiles!geofence_events_user_id_fkey(full_name), sites(name)')
          .order('event_at', { ascending: false })
          .limit(10),
        supabase.from('sites').select('id, name, radius_meters').eq('is_active', true).order('name')
      ]);

      if (shiftsError || eventsError || sitesError) {
        throw shiftsError ?? eventsError ?? sitesError;
      }

      setState({
        loading: false,
        error: null,
        adminName: profile.full_name,
        activeShifts: ((activeShifts ?? []) as unknown as ActiveShiftRow[]).map((shift) => ({
          id: shift.id,
          workerName: shift.profiles?.[0]?.full_name ?? 'Unknown employee',
          siteName: shift.sites?.[0]?.name ?? 'Unassigned site',
          startedAt: shift.started_at ?? 'n/a'
        })),
        recentEvents: ((recentEvents ?? []) as unknown as EventRow[]).map((event) => ({
          id: event.id,
          at: event.event_at,
          label: `${event.profiles?.[0]?.full_name ?? 'Unknown employee'} ${event.event_type} ${event.sites?.[0]?.name ?? 'site'}`
        })),
        sites: ((sites ?? []) as SiteRow[]).map((site) => ({ id: site.id, name: site.name, radius: site.radius_meters }))
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load dashboard.'
      }));
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const stats = useMemo(
    () => [
      ['Active shifts', String(state.activeShifts.length)],
      ['Recent geofence events', String(state.recentEvents.length)],
      ['Active sites', String(state.sites.length)]
    ],
    [state.activeShifts.length, state.recentEvents.length, state.sites.length]
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <main style={{ padding: 32, display: 'grid', gap: 20 }}>
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ color: '#7dd3fc', fontWeight: 700 }}>FIELDOPS CONSENT</div>
        <h1 style={{ margin: 0 }}>Owner dashboard</h1>
        <p style={{ margin: 0, color: '#94a3b8', maxWidth: 760 }}>
          Operational visibility for active work only. Employees consent in the mobile app; owners/admins review active-shift data here.
        </p>
        <div style={{ color: '#cbd5e1' }}>Signed in as: {state.adminName || '...'}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => void loadDashboard()} style={{ padding: '10px 14px', borderRadius: 12, border: 0, background: '#1d4ed8', color: 'white' }}>Refresh</button>
          <button onClick={() => void handleSignOut()} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #334155', background: '#020617', color: 'white' }}>Sign out</button>
        </div>
        {state.error ? <div style={{ color: '#fca5a5' }}>{state.error}</div> : null}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
            <div style={{ color: '#94a3b8' }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{state.loading ? '...' : value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2>Active employees</h2>
          <ul>
            {state.activeShifts.length === 0 ? <li>No active shifts yet.</li> : null}
            {state.activeShifts.map((shift) => (
              <li key={shift.id} style={{ marginBottom: 12 }}>
                <strong>{shift.workerName}</strong> — {shift.siteName} — started {shift.startedAt}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2>Recent events</h2>
          <ul>
            {state.recentEvents.length === 0 ? <li>No geofence events yet.</li> : null}
            {state.recentEvents.map((event) => (
              <li key={event.id} style={{ marginBottom: 12 }}>
                <strong>{event.at}</strong> — {event.label}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2>Sites</h2>
          <ul>
            {state.sites.length === 0 ? <li>No active sites configured.</li> : null}
            {state.sites.map((site) => (
              <li key={site.id} style={{ marginBottom: 12 }}>
                <strong>{site.name}</strong> — radius {site.radius}m
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
