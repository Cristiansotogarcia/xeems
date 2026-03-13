'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatSiteAddress } from '@fieldops/shared';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface DashboardState {
  loading: boolean;
  error: string | null;
  adminName: string;
  activeShifts: Array<{ id: string; workerName: string; siteName: string; startedAt: string }>;
  recentEvents: Array<{ id: string; at: string; label: string }>;
  sites: Array<{
    id: string;
    name: string;
    clientName: string | null;
    radius: number;
    latitude: number;
    longitude: number;
    timezone: string | null;
    addressLabel: string;
  }>;
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
  client_name: string | null;
  radius_meters: number;
  latitude: number;
  longitude: number;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
}

function SiteMap({
  sites
}: {
  sites: DashboardState['sites'];
}) {
  const bounds = useMemo(() => {
    if (sites.length === 0) return null;

    const latitudes = sites.map((site) => site.latitude);
    const longitudes = sites.map((site) => site.longitude);

    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes)
    };
  }, [sites]);

  return (
    <div style={{ background: '#111827', borderRadius: 16, padding: 20, minHeight: 380, display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ marginTop: 0 }}>Client map scaffolding</h2>
        <p style={{ color: '#94a3b8', marginBottom: 0 }}>
          Lightweight MVP map without external map tiles. Good enough to validate named client/site markers and coordinate sanity before adding Mapbox/Google Maps.
        </p>
      </div>
      <div style={{ position: 'relative', borderRadius: 16, minHeight: 260, background: 'linear-gradient(180deg, #082f49 0%, #0f172a 100%)', border: '1px solid #1e293b', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {sites.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#cbd5e1' }}>No active client sites yet.</div>
        ) : (
          sites.map((site) => {
            const latRange = (bounds?.maxLat ?? 0) - (bounds?.minLat ?? 0) || 0.05;
            const lngRange = (bounds?.maxLng ?? 0) - (bounds?.minLng ?? 0) || 0.05;
            const top = 12 + (((bounds?.maxLat ?? site.latitude) - site.latitude) / latRange) * 76;
            const left = 8 + ((site.longitude - (bounds?.minLng ?? site.longitude)) / lngRange) * 82;

            return (
              <div key={site.id} style={{ position: 'absolute', top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)', maxWidth: 180 }}>
                <div style={{ width: 14, height: 14, borderRadius: 999, background: '#38bdf8', border: '3px solid rgba(186,230,253,0.55)', boxShadow: '0 0 0 6px rgba(14,165,233,0.18)' }} />
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, background: 'rgba(2, 6, 23, 0.92)', border: '1px solid #1e293b' }}>
                  <div style={{ fontWeight: 700 }}>{site.name}</div>
                  <div style={{ color: '#7dd3fc', fontSize: 13 }}>{site.clientName ?? 'Client TBD'}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
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

      const { data: profile, error: profileError } = await supabase.from('profiles').select('id, full_name, role').eq('id', userId).single();

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
        supabase
          .from('sites')
          .select('id, name, client_name, radius_meters, latitude, longitude, address_line_1, address_line_2, city, region, postal_code, country_code, timezone')
          .eq('is_active', true)
          .order('name')
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
        sites: ((sites ?? []) as SiteRow[]).map((site) => ({
          id: site.id,
          name: site.name,
          clientName: site.client_name,
          radius: site.radius_meters,
          latitude: site.latitude,
          longitude: site.longitude,
          timezone: site.timezone,
          addressLabel: formatSiteAddress({
            line1: site.address_line_1,
            line2: site.address_line_2,
            city: site.city,
            region: site.region,
            postalCode: site.postal_code,
            countryCode: site.country_code,
            timezone: site.timezone
          })
        }))
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
        <div style={{ color: '#94a3b8' }}>Default geography assumptions target Aruba sites unless a site timezone overrides that.</div>
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

      <section style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16 }}>
        <SiteMap sites={state.sites} />
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Client/site registry</h2>
          <ul>
            {state.sites.length === 0 ? <li>No active sites configured.</li> : null}
            {state.sites.map((site) => (
              <li key={site.id} style={{ marginBottom: 14 }}>
                <strong>{site.name}</strong> — {site.clientName ?? 'No client name'}
                <div style={{ color: '#94a3b8' }}>{site.addressLabel || 'Address not set yet'}</div>
                <div style={{ color: '#94a3b8' }}>
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} — radius {site.radius}m — {site.timezone ?? 'America/Aruba'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
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
      </section>
    </main>
  );
}
