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

interface EmployeeRow {
  id: string;
  email: string | null;
  full_name: string;
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
  profiles: Array<{ full_name: string | null; email: string | null }> | null;
}

interface DesktopActivityRow {
  id: string;
  timestamp: string;
  app_name: string | null;
  window_title: string | null;
  is_productive: boolean | null;
  metadata: { category?: string } | null;
  profiles: Array<{ full_name: string | null }> | null;
  desktop_devices: Array<{ device_name: string | null }> | null;
}

function formatTimestamp(value: string | null) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
}

const REFRESH_INTERVAL_MS = 30000;

const downloadTargets = [
  {
    name: 'Windows desktop',
    description: 'Managed XEEMS installer (.exe) for company laptops.',
    url: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? '',
    cta: 'Download desktop app'
  },
  {
    name: 'Android phone',
    description: 'Internal Android build for company-issued field devices.',
    url: process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL ?? '',
    cta: 'Download Android app'
  },
  {
    name: 'iPhone',
    description: 'Internal iPhone distribution link for company-issued devices.',
    url: process.env.NEXT_PUBLIC_IOS_DOWNLOAD_URL ?? '',
    cta: 'Open iPhone install link'
  }
] as const;

function LandingPage() {
  const router = useRouter();

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #12233d 0%, #09121f 45%, #050913 100%)', padding: '48px 20px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 28 }}>
        <section style={{ textAlign: 'center', display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img src="/xeems-logo.png" alt="XEEMS" style={{ width: 'min(520px, 86vw)', height: 'auto', filter: 'drop-shadow(0 24px 60px rgba(37,99,235,0.24))' }} />
          </div>
          <div>
            <div style={{ color: '#f59e0b', fontSize: 13, letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 12 }}>XEEMS Control Plane</div>
            <h1 style={{ margin: 0, fontSize: 58, lineHeight: 1, letterSpacing: '-0.04em' }}>Company-owned device monitoring</h1>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: 18, maxWidth: 700, margin: '0 auto', lineHeight: 1.7 }}>
            XEEMS provisions employee accounts from the admin dashboard, enrolls Windows laptops once, and keeps the desktop agent running
            on company-owned devices. Mobile remains the field shift and GPS companion.
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <div style={{ padding: 28, borderRadius: 24, background: 'rgba(15, 23, 42, 0.84)', border: '1px solid rgba(249,115,22,0.24)' }}>
            <h2 style={{ marginTop: 0 }}>Admin Dashboard</h2>
            <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
              Admins sign in here, create employee accounts, reset passwords, disable users, and manage desktop devices from one place.
            </p>
            <div style={{ color: '#93c5fd', fontSize: 14, lineHeight: 1.7 }}>If you run `npm run dev` from the repo root, this web portal is the page you should use first.</div>
            <button
              onClick={() => router.push('/login')}
              style={{ marginTop: 18, padding: '14px 18px', borderRadius: 14, border: 0, background: '#f97316', color: '#111827', fontWeight: 700, cursor: 'pointer' }}
            >
              Open admin login
            </button>
          </div>

          <div style={{ padding: 28, borderRadius: 24, background: 'rgba(15, 23, 42, 0.84)', border: '1px solid rgba(37,99,235,0.28)' }}>
            <h2 style={{ marginTop: 0 }}>Deployment posture</h2>
            <ul style={{ color: '#cbd5e1', paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
              <li>Windows desktop agent persists after first login.</li>
              <li>Employees cannot stop monitoring from the app UI.</li>
              <li>Written XEEMS notification replaces in-app consent capture.</li>
            </ul>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Employee app downloads</h2>
            <p style={{ color: '#cbd5e1', margin: 0, lineHeight: 1.7 }}>
              Employees use this portal to install XEEMS on company devices. Publish the Windows installer and mobile install links, then set the public download URLs in the web environment.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {downloadTargets.map((target) => (
              <div key={target.name} style={{ padding: 24, borderRadius: 22, background: 'rgba(15, 23, 42, 0.84)', border: '1px solid rgba(148, 163, 184, 0.16)', display: 'grid', gap: 14 }}>
                <div>
                  <div style={{ color: '#93c5fd', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{target.name}</div>
                  <p style={{ color: '#cbd5e1', margin: 0, lineHeight: 1.7 }}>{target.description}</p>
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
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 700
                    }}
                  >
                    {target.cta}
                  </a>
                ) : (
                  <div style={{ padding: '14px 16px', borderRadius: 14, background: '#1e293b', color: '#94a3b8', fontWeight: 600 }}>
                    Download link not configured yet
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: 20, borderRadius: 20, background: 'rgba(2, 6, 23, 0.72)', border: '1px solid rgba(148, 163, 184, 0.12)', color: '#cbd5e1', lineHeight: 1.7 }}>
            Deployment note: the Windows card should point to the XEEMS installer `.exe`, while the Android and iPhone cards should point to the phone install links you publish for employees.
          </div>
        </section>
      </div>
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
    <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, minHeight: 380, display: 'grid', gap: 12, border: '1px solid rgba(148, 163, 184, 0.12)' }}>
      <div>
        <h2 style={{ marginTop: 0 }}>Field site map</h2>
        <p style={{ color: '#94a3b8', marginBottom: 0 }}>
          Active mobile work sites stay visible here while desktop devices are managed separately as company-owned endpoints.
        </p>
      </div>
      <div style={{ position: 'relative', borderRadius: 20, minHeight: 260, background: 'linear-gradient(180deg, #082032 0%, #0f172a 100%)', border: '1px solid #1e293b', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
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
                <div style={{ width: 14, height: 14, borderRadius: 999, background: '#f97316', border: '3px solid rgba(253,186,116,0.55)', boxShadow: '0 0 0 6px rgba(249,115,22,0.18)' }} />
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, background: 'rgba(2, 6, 23, 0.92)', border: '1px solid #1e293b' }}>
                  <div style={{ fontWeight: 700 }}>{site.name}</div>
                  <div style={{ color: '#93c5fd', fontSize: 13 }}>{site.clientName ?? 'Client TBD'}</div>
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

    const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single();
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

      const { data: profile, error: profileError } = await supabase.from('profiles').select('id, full_name, role, is_active').eq('id', user.id).single();

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
          .order('name'),
        supabase
          .from('profiles')
          .select('id, email, full_name, is_active, created_at')
          .eq('role', 'worker')
          .order('created_at', { ascending: false }),
        supabase
          .from('desktop_devices')
          .select('id, user_id, device_uuid, device_name, os_username, app_version, enrollment_status, monitoring_enabled, last_seen_at, profiles:profiles!desktop_devices_user_id_fkey(full_name, email)')
          .order('last_seen_at', { ascending: false }),
        supabase
          .from('activity_logs')
          .select('id, timestamp, app_name, window_title, is_productive, metadata, profiles:profiles!activity_logs_user_id_fkey(full_name), desktop_devices:desktop_devices!activity_logs_device_id_fkey(device_name)')
          .eq('device_type', 'laptop')
          .order('timestamp', { ascending: false })
          .limit(20)
      ]);

      if (shiftsError || eventsError || sitesError || employeesError || devicesError || desktopActivityError) {
        throw shiftsError ?? eventsError ?? sitesError ?? employeesError ?? devicesError ?? desktopActivityError;
      }

      setState((current) => ({
        ...current,
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
        })),
        employees: ((employees ?? []) as EmployeeRow[]).map((employee) => ({
          id: employee.id,
          email: employee.email,
          fullName: employee.full_name,
          isActive: employee.is_active,
          createdAt: employee.created_at
        })),
        desktopDevices: ((desktopDevices ?? []) as unknown as DesktopDeviceRow[]).map((device) => ({
          id: device.id,
          userId: device.user_id,
          workerName: device.profiles?.[0]?.full_name ?? 'Unknown employee',
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
          workerName: entry.profiles?.[0]?.full_name ?? 'Unknown employee',
          deviceName: entry.desktop_devices?.[0]?.device_name ?? 'Company laptop',
          appName: entry.app_name ?? 'Unknown app',
          windowTitle: entry.window_title ?? 'No window title',
          category: entry.metadata?.category ?? 'neutral',
          isProductive: entry.is_productive === true
        }))
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load dashboard.'
      }));
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
      ['Active shifts', String(state.activeShifts.length)],
      ['Employees', String(state.employees.length)],
      ['Desktop devices', String(state.desktopDevices.length)],
      ['Field sites', String(state.sites.length)]
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

  if (isAuthenticated === false) {
    return <LandingPage />;
  }

  return (
    <main style={{ minHeight: '100vh', padding: 28, background: 'linear-gradient(180deg, #060b13 0%, #0b1220 100%)', display: 'grid', gap: 18 }}>
      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ color: '#f59e0b', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>XEEMS Admin</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 10, maxWidth: 860 }}>
            <img src="/xeems-logo.png" alt="XEEMS" style={{ width: 220, maxWidth: '60vw', height: 'auto' }} />
            <h1 style={{ margin: 0, fontSize: 42, letterSpacing: '-0.04em' }}>Managed device operations</h1>
            <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.7 }}>
              Company-owned XEEMS devices run under written notification, not user-driven consent. Admins provision employee accounts,
              issue credentials, and remotely disable laptops when monitoring should stop.
            </p>
            <div style={{ color: '#cbd5e1' }}>Signed in as: {state.adminName || '...'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => void loadDashboard()} style={{ padding: '12px 16px', borderRadius: 14, border: 0, background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
              Refresh
            </button>
            <button onClick={() => void handleSignOut()} style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid #334155', background: '#020617', color: 'white', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
        <div style={{ borderRadius: 18, padding: 16, background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249,115,22,0.2)', color: '#fed7aa' }}>
          Employees should receive written XEEMS notification outside the app. Desktop laptops are managed endpoints and the desktop agent should remain active after enrollment.
        </div>
        {state.lastIssuedPassword ? (
          <div style={{ borderRadius: 18, padding: 16, background: 'rgba(37, 99, 235, 0.14)', border: '1px solid rgba(59,130,246,0.25)', color: '#dbeafe' }}>
            Latest temporary password: <strong>{state.lastIssuedPassword}</strong>
          </div>
        ) : null}
        {state.error ? <div style={{ color: '#fca5a5' }}>{state.error}</div> : null}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 20, padding: 18, border: '1px solid rgba(148,163,184,0.12)' }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{state.loading ? '...' : value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 16 }}>
        <form onSubmit={handleCreateEmployee} style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, display: 'grid', gap: 14, border: '1px solid rgba(148,163,184,0.12)' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Provision employee account</h2>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Create a worker account, issue a temporary password, and let the user enroll the laptop once.
            </p>
          </div>
          <input
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="Employee full name"
            style={{ padding: 14, borderRadius: 14, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }}
          />
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="employee@company.com"
            style={{ padding: 14, borderRadius: 14, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }}
          />
          <input
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Temporary password"
            style={{ padding: 14, borderRadius: 14, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }}
          />
          <button disabled={isSubmitting} style={{ padding: 14, borderRadius: 14, border: 0, background: '#f97316', color: '#111827', fontWeight: 800, cursor: 'pointer', opacity: isSubmitting ? 0.75 : 1 }}>
            {isSubmitting ? 'Creating employee...' : 'Create employee'}
          </button>
        </form>

        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, display: 'grid', gap: 12, border: '1px solid rgba(148,163,184,0.12)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Desktop rollout checklist</h2>
          <div style={{ color: '#cbd5e1', lineHeight: 1.8 }}>
            <div>1. Create employee account here.</div>
            <div>2. Give the temporary password to the employee.</div>
            <div>3. Employee signs into XEEMS Desktop once.</div>
            <div>4. XEEMS enrolls the company laptop and resumes automatically after restart.</div>
            <div>5. Use device controls below to disable monitoring remotely when needed.</div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.12)' }}>
          <h2 style={{ marginTop: 0 }}>Employee roster</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.employees.length === 0 ? <div style={{ color: '#94a3b8' }}>No employees created yet.</div> : null}
            {state.employees.map((employee) => (
              <div key={employee.id} style={{ borderRadius: 18, padding: 16, background: '#0b1220', border: '1px solid #1e293b', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{employee.fullName}</div>
                    <div style={{ color: '#94a3b8' }}>{employee.email ?? 'No email stored'}</div>
                  </div>
                  <div style={{ color: employee.isActive ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                    {employee.isActive ? 'Active' : 'Disabled'}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: 13 }}>Created {formatTimestamp(employee.createdAt)}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => void handleResetPassword(employee.id)} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', cursor: 'pointer' }}>
                    Reset password
                  </button>
                  <button
                    onClick={() => void handleToggleEmployee(employee.id, !employee.isActive)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: 0,
                      background: employee.isActive ? '#7f1d1d' : '#14532d',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    {employee.isActive ? 'Disable employee' : 'Reactivate employee'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.12)' }}>
          <h2 style={{ marginTop: 0 }}>Desktop devices</h2>
          <div style={{ color: '#94a3b8', marginBottom: 12 }}>Auto-refreshes every 30 seconds so admins can see device heartbeat and control state without asking the employee.</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.desktopDevices.length === 0 ? <div style={{ color: '#94a3b8' }}>No enrolled laptops yet.</div> : null}
            {state.desktopDevices.map((device) => (
              <div key={device.id} style={{ borderRadius: 18, padding: 16, background: '#0b1220', border: '1px solid #1e293b', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{device.deviceName ?? 'Unnamed laptop'}</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>{device.workerName} {device.workerEmail ? `| ${device.workerEmail}` : ''}</div>
                  </div>
                  <div style={{ color: device.monitoringEnabled ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                    {device.monitoringEnabled ? 'Monitoring on' : 'Monitoring off'}
                  </div>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>OS user: {device.osUsername ?? 'n/a'} | App: {device.appVersion ?? 'n/a'}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>Last seen {formatTimestamp(device.lastSeenAt)}</div>
                <div style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>{device.deviceUuid}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ color: '#cbd5e1', fontSize: 13 }}>Status: {device.enrollmentStatus}</div>
                  <button
                    onClick={() => void handleToggleDevice(device.id, !device.monitoringEnabled)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: 0,
                      background: device.monitoringEnabled ? '#7f1d1d' : '#14532d',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    {device.monitoringEnabled ? 'Disable device' : 'Enable device'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.12)' }}>
          <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Live desktop monitor</h2>
            <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.7 }}>
              Recent laptop activity from enrolled XEEMS desktop agents. This feed refreshes automatically every 30 seconds.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {state.desktopActivity.length === 0 ? <div style={{ color: '#94a3b8' }}>No desktop activity captured yet.</div> : null}
            {state.desktopActivity.map((entry) => (
              <div key={entry.id} style={{ borderRadius: 18, padding: 16, background: '#0b1220', border: '1px solid #1e293b', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{entry.appName}</div>
                  <div style={{ color: entry.isProductive ? '#86efac' : '#fbbf24', fontWeight: 700 }}>{entry.category.replaceAll('_', ' ')}</div>
                </div>
                <div style={{ color: '#cbd5e1' }}>{entry.windowTitle}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{entry.workerName} | {entry.deviceName}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{formatTimestamp(entry.at)}</div>
              </div>
            ))}
          </div>
        </div>
        <SiteMap sites={state.sites} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.12)' }}>
          <h2 style={{ marginTop: 0 }}>Client/site registry</h2>
          <ul style={{ paddingLeft: 18 }}>
            {state.sites.length === 0 ? <li>No active sites configured.</li> : null}
            {state.sites.map((site) => (
              <li key={site.id} style={{ marginBottom: 14 }}>
                <strong>{site.name}</strong> | {site.clientName ?? 'No client name'}
                <div style={{ color: '#94a3b8' }}>{site.addressLabel || 'Address not set yet'}</div>
                <div style={{ color: '#94a3b8' }}>
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} | radius {site.radius}m | {site.timezone ?? 'America/Aruba'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.12)' }}>
          <h2 style={{ marginTop: 0 }}>Active field shifts</h2>
          <ul style={{ paddingLeft: 18 }}>
            {state.activeShifts.length === 0 ? <li>No active shifts yet.</li> : null}
            {state.activeShifts.map((shift) => (
              <li key={shift.id} style={{ marginBottom: 12 }}>
                <strong>{shift.workerName}</strong> | {shift.siteName} | started {formatTimestamp(shift.startedAt)}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.92)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.12)' }}>
          <h2 style={{ marginTop: 0 }}>Recent field events</h2>
          <ul style={{ paddingLeft: 18 }}>
            {state.recentEvents.length === 0 ? <li>No geofence events yet.</li> : null}
            {state.recentEvents.map((event) => (
              <li key={event.id} style={{ marginBottom: 12 }}>
                <strong>{formatTimestamp(event.at)}</strong> | {event.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
