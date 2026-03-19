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
  employees: Array<{
    id: string;
    email: string | null;
    fullName: string;
    isActive: boolean;
    createdAt: string;
  }>;
  desktopDevices: Array<{
    id: string;
    userId: string;
    workerName: string;
    workerEmail: string | null;
    deviceUuid: string;
    deviceName: string | null;
    osUsername: string | null;
    appVersion: string | null;
    enrollmentStatus: string;
    monitoringEnabled: boolean;
    lastSeenAt: string;
  }>;
  desktopActivity: Array<{
    id: string;
    at: string;
    workerName: string;
    deviceName: string;
    appName: string;
    windowTitle: string;
    category: string;
    isProductive: boolean;
  }>;
  lastIssuedPassword: string | null;
}

interface ActiveShiftRow {
  id: string;
  started_at: string | null;
  profiles: Array<{ full_name?: string | null; email?: string | null }> | null;
  sites: Array<{ name: string | null }> | null;
}

interface EventRow {
  id: string;
  event_at: string;
  event_type: string;
  profiles: Array<{ full_name?: string | null; email?: string | null }> | null;
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

interface EmployeeRow {
  id: string;
  email: string | null;
  full_name?: string | null;
  is_active: boolean;
  created_at: string;
}

interface DesktopDeviceRow {
  id: string;
  user_id: string;
  device_uuid: string;
  device_name: string | null;
  os_username: string | null;
  app_version: string | null;
  enrollment_status: string;
  monitoring_enabled: boolean;
  last_seen_at: string;
  profiles: Array<{ full_name?: string | null; email?: string | null }> | null;
}

interface DesktopActivityRow {
  id: string;
  timestamp: string;
  app_name: string | null;
  window_title: string | null;
  is_productive: boolean | null;
  metadata: { category?: string } | null;
  profiles: Array<{ full_name?: string | null; email?: string | null }> | null;
  desktop_devices: Array<{ device_name: string | null }> | null;
}

const REFRESH_INTERVAL_MS = 30000;
const defaultDesktopDownloadUrl = 'https://github.com/Cristiansotogarcia/xeems/releases/download/v1.0.0/XEEMS-1.0.0.exe';
const defaultAndroidDownloadUrl = 'https://expo.dev/artifacts/eas/kFW8kcMSM1a7RzZ6f8kgzb.apk';

const downloadTargets = [
  {
    name: 'Windows desktop',
    description: 'Managed XEEMS installer (.exe) for company laptops.',
    url: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? defaultDesktopDownloadUrl,
    cta: 'Download desktop app'
  },
  {
    name: 'Android phone',
    description: 'Internal Android build for company-issued field devices.',
    url: process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL ?? defaultAndroidDownloadUrl,
    cta: 'Download Android app'
  },
  {
    name: 'iPhone',
    description: 'Internal iPhone distribution link for company-issued devices.',
    url: process.env.NEXT_PUBLIC_IOS_DOWNLOAD_URL ?? '',
    cta: 'Open iPhone install link'
  }
] as const;

function formatTimestamp(value: string | null) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('en-US', { hour12: false });
  } catch {
    return value;
  }
}

function getProfileLabel(profile: { full_name?: string | null; email?: string | null } | null | undefined) {
  const fullName = profile?.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const email = profile?.email?.trim();
  if (email) {
    return email;
  }

  return 'Unknown employee';
}

function LandingPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(14,165,233,0.12) 0%, rgba(249,250,251,0) 38%), linear-gradient(180deg, #f9fbfd 0%, #edf4fa 100%)',
        padding: '48px 20px'
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 30 }}>
        <header className="landing-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
          <img src="/xeems-logo.png" alt="XEEMS" style={{ width: 'min(260px, 72vw)', height: 'auto' }} />
          <button
            className="landing-admin-button"
            onClick={() => router.push('/login')}
            style={{ padding: '14px 20px', borderRadius: 999, border: 0, background: '#10233d', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 16px 34px rgba(16,35,61,0.16)' }}
          >
            Admin login
          </button>
        </header>

        <section style={{ display: 'grid', gap: 18, textAlign: 'center', padding: '14px 0 10px' }}>
          <div style={{ color: '#f59e0b', fontSize: 13, letterSpacing: '0.22em', textTransform: 'uppercase' }}>XA Tech&apos;s Employee Efficiency Monitoring System</div>
          <h1 style={{ margin: 0, fontSize: 58, lineHeight: 0.98, letterSpacing: '-0.05em', color: '#10233d' }}>One portal for admin access and company-device installs</h1>
          <p style={{ color: '#4b5f75', fontSize: 18, maxWidth: 760, margin: '0 auto', lineHeight: 1.7 }}>
            XEEMS gives administrators one place to manage employee accounts, watch live operations, and distribute the desktop and mobile apps used on company devices.
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {downloadTargets.map((target) => (
            <div key={target.name} style={{ padding: 24, borderRadius: 24, background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(148,163,184,0.18)', display: 'grid', gap: 14, boxShadow: '0 24px 60px rgba(16,35,61,0.08)' }}>
              <div>
                <div style={{ color: '#355372', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{target.name}</div>
                <p style={{ color: '#4b5f75', margin: 0, lineHeight: 1.7 }}>{target.description}</p>
              </div>
              {target.url ? (
                <a
                  href={target.url}
                  style={{
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: '#1d62d1',
                    color: '#fff',
                    fontWeight: 700
                  }}
                >
                  {target.cta}
                </a>
              ) : (
                <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eef4fa', color: '#5f7288', fontWeight: 600 }}>
                  Download link not configured yet
                </div>
              )}
            </div>
          ))}
        </section>
        <style jsx>{`
          @media (max-width: 720px) {
            .landing-header {
              flex-direction: column-reverse;
              align-items: stretch;
            }

            .landing-admin-button {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    adminName: '',
    activeShifts: [],
    recentEvents: [],
    sites: [],
    employees: [],
    desktopDevices: [],
    desktopActivity: [],
    lastIssuedPassword: null
  });
  const [extendedEvents, setExtendedEvents] = useState<DashboardState['recentEvents']>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [loadingExtendedEvents, setLoadingExtendedEvents] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  async function getAccessToken() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async function callAdminApi(path: string, body?: Record<string, unknown>) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Admin session expired.');
    }

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body ?? {})
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; [key: string]: unknown };
    if (!response.ok) {
      throw new Error(payload.error ?? `Request failed: ${response.status}`);
    }

    return payload;
  }

  async function checkAuth() {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setIsAuthenticated(false);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile?.role !== 'admin' || profile?.is_active !== true) {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
  }

  async function loadDashboard() {
    try {
      setState((current) => ({ ...current, loading: true, error: null }));

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      if (profileError) {
        throw profileError;
      }

      if (profile.role !== 'admin' || profile.is_active !== true) {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        return;
      }

      const [
        { data: activeShifts, error: shiftsError },
        { data: recentEvents, error: eventsError },
        { data: sites, error: sitesError },
        { data: employees, error: employeesError },
        { data: desktopDevices, error: devicesError },
        { data: desktopActivity, error: desktopActivityError }
      ] = await Promise.all([
        supabase
          .from('shifts')
          .select('id, started_at, profiles:profiles!shifts_user_id_fkey(*), sites(name)')
          .eq('status', 'active')
          .order('started_at', { ascending: false }),
        supabase
          .from('geofence_events')
          .select('id, event_at, event_type, profiles:profiles!geofence_events_user_id_fkey(*), sites(name)')
          .order('event_at', { ascending: false })
          .limit(10),
        supabase
          .from('sites')
          .select('id, name, client_name, radius_meters, latitude, longitude, address_line_1, address_line_2, city, region, postal_code, country_code, timezone')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('*')
          .eq('role', 'worker')
          .order('created_at', { ascending: false }),
        supabase
          .from('desktop_devices')
          .select('id, user_id, device_uuid, device_name, os_username, app_version, enrollment_status, monitoring_enabled, last_seen_at, profiles:profiles!desktop_devices_user_id_fkey(*)')
          .order('last_seen_at', { ascending: false }),
        supabase
          .from('activity_logs')
          .select('id, timestamp, app_name, window_title, is_productive, metadata, profiles:profiles!activity_logs_user_id_fkey(*), desktop_devices:desktop_devices!activity_logs_device_id_fkey(device_name)')
          .eq('device_type', 'laptop')
          .order('timestamp', { ascending: false })
          .limit(20)
      ]);

      if (shiftsError || eventsError || sitesError || employeesError || devicesError || desktopActivityError) {
        throw shiftsError ?? eventsError ?? sitesError ?? employeesError ?? devicesError ?? desktopActivityError;
      }

      const mappedEvents = ((recentEvents ?? []) as unknown as EventRow[]).map((event) => ({
        id: event.id,
        at: event.event_at,
        label: `${getProfileLabel(event.profiles?.[0])} ${event.event_type} ${event.sites?.[0]?.name ?? 'site'}`
      }));

      setState((current) => ({
        ...current,
        loading: false,
        error: null,
        adminName: getProfileLabel(profile),
        activeShifts: ((activeShifts ?? []) as unknown as ActiveShiftRow[]).map((shift) => ({
          id: shift.id,
          workerName: getProfileLabel(shift.profiles?.[0]),
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
        })),
        employees: ((employees ?? []) as EmployeeRow[]).map((employee) => ({
          id: employee.id,
          email: employee.email,
          fullName: employee.full_name?.trim() || employee.email || 'Employee',
          isActive: employee.is_active,
          createdAt: employee.created_at
        })),
        desktopDevices: ((desktopDevices ?? []) as unknown as DesktopDeviceRow[]).map((device) => ({
          id: device.id,
          userId: device.user_id,
          workerName: getProfileLabel(device.profiles?.[0]),
          workerEmail: device.profiles?.[0]?.email ?? null,
          deviceUuid: device.device_uuid,
          deviceName: device.device_name,
          osUsername: device.os_username,
          appVersion: device.app_version,
          enrollmentStatus: device.enrollment_status,
          monitoringEnabled: device.monitoring_enabled,
          lastSeenAt: device.last_seen_at
        })),
        desktopActivity: ((desktopActivity ?? []) as unknown as DesktopActivityRow[]).map((entry) => ({
          id: entry.id,
          at: entry.timestamp,
          workerName: getProfileLabel(entry.profiles?.[0]),
          deviceName: entry.desktop_devices?.[0]?.device_name ?? 'Company laptop',
          appName: entry.app_name ?? 'Unknown app',
          windowTitle: entry.window_title ?? 'No window title',
          category: entry.metadata?.category ?? 'neutral',
          isProductive: entry.is_productive === true
        }))
      }));

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
        .select('id, event_at, event_type, profiles:profiles!geofence_events_user_id_fkey(*), sites(name)')
        .order('event_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const mapped = ((data ?? []) as EventRow[]).map((event) => ({
        id: event.id,
        at: event.event_at,
        label: `${getProfileLabel(event.profiles?.[0])} ${event.event_type} ${event.sites?.[0]?.name ?? 'site'}`
      }));
      setExtendedEvents(mapped);
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : 'Unable to load events.');
    } finally {
      setLoadingExtendedEvents(false);
    }
  }

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  const stats = useMemo(
    () => [
      { label: 'Active shifts', value: String(state.activeShifts.length), icon: '🟢', note: 'Live shift sessions' },
      { label: 'Employees', value: String(state.employees.length), icon: '👥', note: 'Active worker accounts' },
      { label: 'Desktop devices', value: String(state.desktopDevices.length), icon: '💻', note: 'Enrolled laptops' },
      { label: 'Field sites', value: String(state.sites.length), icon: '📍', note: 'Active client locations' }
    ],
    [state.activeShifts.length, state.employees.length, state.desktopDevices.length, state.sites.length]
  );

  async function handleCreateEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setState((current) => ({ ...current, error: null, lastIssuedPassword: null }));
      const payload = await callAdminApi('/api/admin/employees', form);
      setState((current) => ({
        ...current,
        lastIssuedPassword: form.password,
        error: null
      }));
      setForm({ email: '', fullName: '', password: '' });
      await loadDashboard();
      void payload;
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to create employee.'
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(employeeId: string) {
    try {
      const generated = `Xeems!${Math.random().toString(36).slice(2, 10)}9`;
      const payload = await callAdminApi(`/api/admin/employees/${employeeId}/reset-password`, { password: generated });
      setState((current) => ({
        ...current,
        lastIssuedPassword: String(payload.password ?? generated),
        error: null
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to reset password.'
      }));
    }
  }

  async function handleToggleEmployee(employeeId: string, isActive: boolean) {
    try {
      await callAdminApi(`/api/admin/employees/${employeeId}/status`, { isActive });
      await loadDashboard();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to update employee state.'
      }));
    }
  }

  async function handleToggleDevice(deviceId: string, monitoringEnabled: boolean) {
    try {
      await callAdminApi(`/api/admin/devices/${deviceId}/${monitoringEnabled ? 'enable' : 'disable'}`);
      await loadDashboard();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to update device state.'
      }));
    }
  }

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

  if (isAuthenticated === false) {
    return <LandingPage />;
  }

  return (
    <main className="page">
      <Card className="hero">
        <div className="tag">XEEMS ADMIN</div>
        <div className="hero-row">
          <h1>Admin operations dashboard</h1>
          <p>Monitor live field shifts, desktop activity, and company devices from one view.</p>
          <div className="muted">Signed in as: {state.adminName || '...'}</div>
        </div>
        <div className="actions">
          <button className="button primary" onClick={() => void loadDashboard()}>Refresh</button>
          <button className="button ghost" onClick={() => void handleSignOut()}>Sign out</button>
        </div>
        {state.lastIssuedPassword ? <div className="alert">Latest temporary password: <strong>{state.lastIssuedPassword}</strong></div> : null}
        {state.error ? <div className="alert">{state.error}</div> : null}
      </Card>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} note={stat.note} icon={stat.icon} loading={state.loading} />
        ))}
      </div>

      <div className="grid-2">
        <Card className="spacious">
          <SectionHeader title="Provision employee account" subtitle="Create a worker account and issue a password" />
          <form onSubmit={handleCreateEmployee} style={{ display: 'grid', gap: 12 }}>
            <input
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="Employee full name"
              style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="employee@company.com"
              style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
            <input
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Temporary password"
              style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
            <button disabled={isSubmitting} className="button primary" style={{ justifySelf: 'start' }}>
              {isSubmitting ? 'Creating employee...' : 'Create employee'}
            </button>
          </form>
        </Card>

        <Card className="spacious">
          <SectionHeader title="Desktop devices" subtitle="Heartbeat + control for enrolled laptops (auto-refreshes)" />
          {state.desktopDevices.length === 0 ? (
            <EmptyState message="No enrolled laptops yet." />
          ) : (
            <div className="table">
              {state.desktopDevices.map((device) => (
                <div className="row" key={device.id} style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                  <div>
                    <strong>{device.deviceName ?? 'Unnamed laptop'}</strong>
                    <div className="muted">{device.workerName} {device.workerEmail ? `| ${device.workerEmail}` : ''}</div>
                    <div className="meta">OS user: {device.osUsername ?? 'n/a'} · App: {device.appVersion ?? 'n/a'}</div>
                  </div>
                  <div className="meta">
                    Last seen {formatTimestamp(device.lastSeenAt)}
                    <div style={{ marginTop: 6 }}>{device.deviceUuid}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                    <Badge label={`Status: ${device.enrollmentStatus}`} variant="info" />
                    <Badge label={device.monitoringEnabled ? 'Monitoring on' : 'Monitoring off'} variant={device.monitoringEnabled ? 'success' : 'warning'} />
                    <button className="button ghost" onClick={() => void handleToggleDevice(device.id, !device.monitoringEnabled)}>
                      {device.monitoringEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card className="spacious">
          <SectionHeader title="Employee roster" subtitle="Workers with account state" />
          {state.employees.length === 0 ? (
            <EmptyState message="No employees created yet." />
          ) : (
            <div className="table">
              {state.employees.map((employee) => (
                <div className="row" key={employee.id} style={{ gridTemplateColumns: '1fr 0.6fr auto' }}>
                  <div>
                    <strong>{employee.fullName}</strong>
                    <div className="muted">{employee.email ?? 'No email stored'}</div>
                    <div className="meta">Created {formatTimestamp(employee.createdAt)}</div>
                  </div>
                  <div>{employee.isActive ? <Badge label="Active" variant="success" /> : <Badge label="Disabled" variant="warning" />}</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="button ghost" onClick={() => void handleResetPassword(employee.id)}>Reset password</button>
                    <button className="button ghost" onClick={() => void handleToggleEmployee(employee.id, !employee.isActive)}>
                      {employee.isActive ? 'Disable' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="spacious">
          <SectionHeader
            title="Live desktop monitor"
            subtitle="Latest laptop activity (trimmed to 10)"
            action={<button className="button ghost" onClick={() => setShowActivityModal(true)}>View all activity</button>}
          />
          {state.desktopActivity.length === 0 ? (
            <EmptyState message="No desktop activity captured yet." />
          ) : (
            <div className="feed-list">
              {state.desktopActivity.slice(0, 10).map((entry) => (
                <div className="feed-item" key={entry.id}>
                  <div className="feed-time">{formatDateTime(entry.at)}</div>
                  <div className="feed-label">
                    <div><strong>{entry.appName}</strong> · {entry.category.replaceAll('_', ' ')}</div>
                    <div className="muted">{entry.windowTitle}</div>
                    <div className="meta">{entry.workerName} | {entry.deviceName}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
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
          <SectionHeader title="Active field shifts" subtitle="Live shift roster" />
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
            title="Recent field events"
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
        title="All recent field events"
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

      <Modal
        title="All desktop activity"
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        footer={<button className="button ghost" onClick={() => setShowActivityModal(false)}>Close</button>}
      >
        {state.desktopActivity.length === 0 ? (
          <EmptyState message="No desktop activity captured yet." />
        ) : (
          <div className="feed-list" style={{ maxHeight: 'unset' }}>
            {state.desktopActivity.map((entry) => (
              <div className="feed-item" key={entry.id}>
                <div className="feed-time">{formatDateTime(entry.at)}</div>
                <div className="feed-label">
                  <div><strong>{entry.appName}</strong> · {entry.category.replaceAll('_', ' ')}</div>
                  <div className="muted">{entry.windowTitle}</div>
                  <div className="meta">{entry.workerName} | {entry.deviceName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </main>
  );
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
      <SectionHeader title="Field site map" subtitle="Active mobile sites; desktop devices managed separately." />
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
