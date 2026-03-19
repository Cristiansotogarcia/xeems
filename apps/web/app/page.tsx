'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatSiteAddress } from '@fieldops/shared';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import './dashboard.css';
import Badge from './components/Badge';
import Card from './components/Card';
import EmptyState from './components/EmptyState';
import Modal from './components/Modal';
import SectionHeader from './components/SectionHeader';
import StatCard from './components/StatCard';

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

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('en-US', { hour12: false });
  } catch {
    return value;
  }
}

function SiteMap({ sites }: { sites: DashboardState['sites'] }) {
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
    <Card className="map-card">
      <SectionHeader title="Client map scaffold" subtitle="Validate site markers before swapping in Mapbox/Google maps." />
      <div className="legend">
        <span className="legend-dot" />
        Active client sites mapped to rough coordinates
      </div>
      <div className="map-surface">
        <div className="map-grid" />
        {sites.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
            No active client sites yet.
          </div>
        ) : (
          sites.map((site) => {
            const latRange = (bounds?.maxLat ?? 0) - (bounds?.minLat ?? 0) || 0.05;
            const lngRange = (bounds?.maxLng ?? 0) - (bounds?.minLng ?? 0) || 0.05;
            const top = 12 + (((bounds?.maxLat ?? site.latitude) - site.latitude) / latRange) * 76;
            const left = 8 + ((site.longitude - (bounds?.minLng ?? site.longitude)) / lngRange) * 82;

            return (
              <div key={site.id} style={{ position: 'absolute', top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}>
                <div className="legend-dot" style={{ width: 14, height: 14, boxShadow: '0 0 0 6px rgba(14,165,233,0.18)' }} />
                <div className="marker-card">
                  <div style={{ fontWeight: 700 }}>{site.name}</div>
                  <div style={{ color: '#7dd3fc', fontSize: 13 }}>{site.clientName ?? 'Client TBD'}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {sites.length > 0 ? (
        <div className="meta">
          Bounding box: {sites.length} marker(s) across {((bounds?.maxLat ?? 0) - (bounds?.minLat ?? 0)).toFixed(2)} lat /{' '}
          {((bounds?.maxLng ?? 0) - (bounds?.minLng ?? 0)).toFixed(2)} lng span
        </div>
      ) : null}
    </Card>
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
  const [extendedEvents, setExtendedEvents] = useState<DashboardState['recentEvents']>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [loadingExtendedEvents, setLoadingExtendedEvents] = useState(false);

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

      const mappedEvents = ((recentEvents ?? []) as unknown as EventRow[]).map((event) => ({
        id: event.id,
        at: event.event_at,
        label: `${event.profiles?.[0]?.full_name ?? 'Unknown employee'} ${event.event_type} ${event.sites?.[0]?.name ?? 'site'}`
      }));

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
        recentEvents: mappedEvents,
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

      setExtendedEvents((current) => (current.length > mappedEvents.length ? current : mappedEvents));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load dashboard.'
      }));
    }
  }

  async function loadExtendedEvents() {
    try {
      setLoadingExtendedEvents(true);
      setEventsError(null);
      const { data, error } = await supabase
        .from('geofence_events')
        .select('id, event_at, event_type, profiles:profiles!geofence_events_user_id_fkey(full_name), sites(name)')
        .order('event_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const mapped = ((data ?? []) as EventRow[]).map((event) => ({
        id: event.id,
        at: event.event_at,
        label: `${event.profiles?.[0]?.full_name ?? 'Unknown employee'} ${event.event_type} ${event.sites?.[0]?.name ?? 'site'}`
      }));
      setExtendedEvents(mapped);
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : 'Unable to load events.');
    } finally {
      setLoadingExtendedEvents(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Active shifts', value: String(state.activeShifts.length), icon: '🟢', note: 'Live shift sessions' },
      { label: 'Recent geofence events', value: String(state.recentEvents.length), icon: '📍', note: 'Latest 10 events' },
      { label: 'Active sites', value: String(state.sites.length), icon: '🏢', note: 'Configured client locations' }
    ],
    [state.activeShifts.length, state.recentEvents.length, state.sites.length]
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function handleOpenEvents() {
    setShowEventsModal(true);
    if (extendedEvents.length <= state.recentEvents.length) {
      void loadExtendedEvents();
    }
  }

  return (
    <main className="page">
      <Card className="hero">
        <div className="tag">FIELDOPS CONSENT</div>
        <div className="hero-row">
          <h1>Owner dashboard</h1>
          <p>Operational visibility for active work only. Employees consent in the mobile app; owners/admins review active-shift data here.</p>
          <div className="muted">Signed in as: {state.adminName || '...'}</div>
          <div className="muted">Default geography assumptions target Aruba sites unless a site timezone overrides that.</div>
        </div>
        <div className="actions">
          <button className="button primary" onClick={() => void loadDashboard()}>Refresh</button>
          <button className="button ghost" onClick={() => void handleSignOut()}>Sign out</button>
          <a className="quiet-link" href="https://github.com/fieldops/workforce-gps-consent-mvp/blob/main/README.md#current-mvp-state" target="_blank" rel="noreferrer">
            Ops notes in README
          </a>
        </div>
        {state.error ? <div className="alert">{state.error}</div> : null}
      </Card>

      <div className="grid-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} note={stat.note} icon={stat.icon} loading={state.loading} />
        ))}
      </div>

      <div className="grid-2">
        <SiteMap sites={state.sites} />

        <Card className="spacious">
          <SectionHeader title="Client/site registry" subtitle="Active client locations with address + timezone" />
          {state.sites.length === 0 ? (
            <EmptyState message="No active sites configured yet." action={<span className="quiet-link">Add sites in Supabase or seed SQL</span>} />
          ) : (
            <div className="table">
              {state.sites.map((site) => (
                <div className="row" key={site.id}>
                  <div>
                    <strong>{site.name}</strong>
                    <div className="muted">{site.clientName ?? 'No client name'}</div>
                  </div>
                  <div className="address">{site.addressLabel || 'Address not set yet'}</div>
                  <div className="meta">
                    {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Badge label={`Radius ${site.radius}m`} variant="info" />
                    <Badge label={site.timezone ?? 'America/Aruba'} variant="neutral" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card className="spacious">
          <SectionHeader title="Active employees" subtitle="Live shift roster" />
          {state.activeShifts.length === 0 ? (
            <EmptyState message="No active shifts yet." />
          ) : (
            <div className="table">
              {state.activeShifts.map((shift) => (
                <div className="row condensed" key={shift.id}>
                  <strong>{shift.workerName}</strong>
                  <div className="muted">{shift.siteName}</div>
                  <div className="meta">Started {formatDateTime(shift.startedAt)}</div>
                  <span className="chip">On shift</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="spacious">
          <SectionHeader
            title="Recent events"
            subtitle="Latest 10 geofence events"
            action={
              <button className="button ghost" onClick={handleOpenEvents}>
                View all events
              </button>
            }
          />
          {state.recentEvents.length === 0 ? (
            <EmptyState message="No geofence events yet." />
          ) : (
            <div className="feed-list">
              {state.recentEvents.slice(0, 10).map((event) => (
                <div className="feed-item" key={event.id}>
                  <div className="feed-time">{formatDateTime(event.at)}</div>
                  <div className="feed-label">{event.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        title="All recent events"
        open={showEventsModal}
        onClose={() => setShowEventsModal(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            {eventsError ? <div className="alert" style={{ margin: 0 }}>{eventsError}</div> : <div className="muted">Showing up to 50 most recent events</div>}
            <button className="button ghost" onClick={() => setShowEventsModal(false)}>Close</button>
          </div>
        }
      >
        {loadingExtendedEvents ? (
          <div className="empty">Loading events…</div>
        ) : extendedEvents.length === 0 ? (
          <EmptyState message="No events to display yet." />
        ) : (
          <div className="feed-list" style={{ maxHeight: 'unset' }}>
            {extendedEvents.map((event) => (
              <div className="feed-item" key={event.id}>
                <div className="feed-time">{formatDateTime(event.at)}</div>
                <div className="feed-label">{event.label}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </main>
  );
}
