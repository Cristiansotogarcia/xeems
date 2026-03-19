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

function formatTimestamp(value: string | null) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
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
          <div style={{ padding: 24, borderRadius: 26, background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(16,35,61,0.08)', boxShadow: '0 24px 60px rgba(16,35,61,0.08)' }}>
            <div style={{ color: '#355372', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Admin portal</div>
            <h2 style={{ marginTop: 0, marginBottom: 10, color: '#10233d' }}>Live oversight</h2>
            <p style={{ color: '#4b5f75', margin: 0, lineHeight: 1.7 }}>Create employee accounts, manage enrolled laptops, and review live field and desktop activity.</p>
          </div>
          <div style={{ padding: 24, borderRadius: 26, background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(16,35,61,0.08)', boxShadow: '0 24px 60px rgba(16,35,61,0.08)' }}>
            <div style={{ color: '#355372', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Desktop</div>
            <h2 style={{ marginTop: 0, marginBottom: 10, color: '#10233d' }}>Managed laptop agent</h2>
            <p style={{ color: '#4b5f75', margin: 0, lineHeight: 1.7 }}>Employees sign in once on the company laptop and XEEMS keeps the desktop agent running after enrollment.</p>
          </div>
          <div style={{ padding: 24, borderRadius: 26, background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(16,35,61,0.08)', boxShadow: '0 24px 60px rgba(16,35,61,0.08)' }}>
            <div style={{ color: '#355372', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Mobile</div>
            <h2 style={{ marginTop: 0, marginBottom: 10, color: '#10233d' }}>Shift and GPS workflow</h2>
            <p style={{ color: '#4b5f75', margin: 0, lineHeight: 1.7 }}>Employees start and end shifts, lunch breaks, and pauses from the company phone while GPS stays tied to active work time.</p>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8, textAlign: 'center' }}>
            <h2 style={{ margin: 0, color: '#10233d' }}>Download XEEMS apps</h2>
            <p style={{ color: '#4b5f75', margin: 0, lineHeight: 1.7 }}>Use the links below to install the employee apps on company devices.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
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
          </div>
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
    <div style={{ background: 'rgba(255, 255, 255, 0.94)', borderRadius: 24, padding: 22, minHeight: 380, display: 'grid', gap: 12, border: '1px solid rgba(148, 163, 184, 0.18)', boxShadow: '0 24px 60px rgba(16,35,61,0.08)' }}>
      <div>
        <h2 style={{ marginTop: 0 }}>Field site map</h2>
        <p style={{ color: '#5f7288', marginBottom: 0 }}>
          Active mobile work sites stay visible here while desktop devices are managed separately as company-owned endpoints.
        </p>
      </div>
      <div style={{ position: 'relative', borderRadius: 20, minHeight: 260, background: 'linear-gradient(180deg, #f4f8fb 0%, #dde9f4 100%)', border: '1px solid #d5e2ee', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        {sites.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#355372' }}>No active client sites yet.</div>
        ) : (
          sites.map((site) => {
            const latRange = (bounds?.maxLat ?? 0) - (bounds?.minLat ?? 0) || 0.05;
            const lngRange = (bounds?.maxLng ?? 0) - (bounds?.minLng ?? 0) || 0.05;
            const top = 12 + (((bounds?.maxLat ?? site.latitude) - site.latitude) / latRange) * 76;
            const left = 8 + ((site.longitude - (bounds?.minLng ?? site.longitude)) / lngRange) * 82;

            return (
              <div key={site.id} style={{ position: 'absolute', top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)', maxWidth: 180 }}>
                <div style={{ width: 14, height: 14, borderRadius: 999, background: '#f97316', border: '3px solid rgba(253,186,116,0.55)', boxShadow: '0 0 0 6px rgba(249,115,22,0.18)' }} />
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.96)', border: '1px solid #d5e2ee', boxShadow: '0 12px 24px rgba(16,35,61,0.08)' }}>
                  <div style={{ fontWeight: 700 }}>{site.name}</div>
                  <div style={{ color: '#355372', fontSize: 13 }}>{site.clientName ?? 'Client TBD'}</div>
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
        recentEvents: ((recentEvents ?? []) as unknown as EventRow[]).map((event) => ({
          id: event.id,
          at: event.event_at,
          label: `${getProfileLabel(event.profiles?.[0])} ${event.event_type} ${event.sites?.[0]?.name ?? 'site'}`
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
    <main
      style={{
        minHeight: '100vh',
        padding: 28,
        background:
          'radial-gradient(circle at top, rgba(14,165,233,0.12) 0%, rgba(249,250,251,0) 36%), linear-gradient(180deg, #f9fbfd 0%, #edf4fa 100%)',
        display: 'grid',
        gap: 18
      }}
    >
      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ color: '#f59e0b', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>XA Tech&apos;s Employee Efficiency Monitoring System</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 10, maxWidth: 860 }}>
            <img src="/xeems-logo.png" alt="XEEMS" style={{ width: 380, maxWidth: '82vw', height: 'auto' }} />
            <h1 style={{ margin: 0, fontSize: 42, letterSpacing: '-0.04em', color: '#10233d' }}>Admin operations dashboard</h1>
            <p style={{ margin: 0, color: '#5f7288', lineHeight: 1.7 }}>Monitor live activity, manage employees, and control company devices from one place.</p>
            <div style={{ color: '#355372' }}>Signed in as: {state.adminName || '...'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => void loadDashboard()} style={{ padding: '12px 16px', borderRadius: 14, border: 0, background: '#1d62d1', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
              Refresh
            </button>
            <button onClick={() => void handleSignOut()} style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid #c6d5e3', background: '#ffffff', color: '#10233d', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
        {state.lastIssuedPassword ? (
          <div style={{ borderRadius: 18, padding: 16, background: 'rgba(29, 98, 209, 0.08)', border: '1px solid rgba(29,98,209,0.18)', color: '#183857' }}>
            Latest temporary password: <strong>{state.lastIssuedPassword}</strong>
          </div>
        ) : null}
        {state.error ? <div style={{ color: '#fca5a5' }}>{state.error}</div> : null}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 20, padding: 18, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
            <div style={{ color: '#5f7288', fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{state.loading ? '...' : value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <form onSubmit={handleCreateEmployee} style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, display: 'grid', gap: 14, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Provision employee account</h2>
            <p style={{ margin: 0, color: '#5f7288' }}>Create a worker account and issue the first sign-in password.</p>
          </div>
          <input
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="Employee full name"
            style={{ padding: 14, borderRadius: 14, border: '1px solid #c6d5e3', background: '#f9fbfd', color: '#10233d' }}
          />
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="employee@company.com"
            style={{ padding: 14, borderRadius: 14, border: '1px solid #c6d5e3', background: '#f9fbfd', color: '#10233d' }}
          />
          <input
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Temporary password"
            style={{ padding: 14, borderRadius: 14, border: '1px solid #c6d5e3', background: '#f9fbfd', color: '#10233d' }}
          />
          <button disabled={isSubmitting} style={{ padding: 14, borderRadius: 14, border: 0, background: '#f97316', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: isSubmitting ? 0.75 : 1 }}>
            {isSubmitting ? 'Creating employee...' : 'Create employee'}
          </button>
        </form>

        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, display: 'grid', gap: 12, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Operations summary</h2>
          <div style={{ color: '#355372', lineHeight: 1.8 }}>
            <div>Employee accounts, field shifts, desktop devices, and live activity are managed from this dashboard.</div>
            <div>Use the tables below to reset passwords, disable accounts, and control enrolled laptops remotely.</div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Employee roster</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.employees.length === 0 ? <div style={{ color: '#5f7288' }}>No employees created yet.</div> : null}
            {state.employees.map((employee) => (
              <div key={employee.id} style={{ borderRadius: 18, padding: 16, background: '#f9fbfd', border: '1px solid #d5e2ee', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{employee.fullName}</div>
                    <div style={{ color: '#5f7288' }}>{employee.email ?? 'No email stored'}</div>
                  </div>
                  <div style={{ color: employee.isActive ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                    {employee.isActive ? 'Active' : 'Disabled'}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: 13 }}>Created {formatTimestamp(employee.createdAt)}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => void handleResetPassword(employee.id)} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #c6d5e3', background: '#ffffff', color: '#10233d', cursor: 'pointer' }}>
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

        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Desktop devices</h2>
          <div style={{ color: '#5f7288', marginBottom: 12 }}>Auto-refreshes every 30 seconds so admins can see device heartbeat and control state without asking the employee.</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.desktopDevices.length === 0 ? <div style={{ color: '#5f7288' }}>No enrolled laptops yet.</div> : null}
            {state.desktopDevices.map((device) => (
              <div key={device.id} style={{ borderRadius: 18, padding: 16, background: '#f9fbfd', border: '1px solid #d5e2ee', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{device.deviceName ?? 'Unnamed laptop'}</div>
                    <div style={{ color: '#5f7288', fontSize: 14 }}>{device.workerName} {device.workerEmail ? `| ${device.workerEmail}` : ''}</div>
                  </div>
                  <div style={{ color: device.monitoringEnabled ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                    {device.monitoringEnabled ? 'Monitoring on' : 'Monitoring off'}
                  </div>
                </div>
                <div style={{ color: '#5f7288', fontSize: 13 }}>OS user: {device.osUsername ?? 'n/a'} | App: {device.appVersion ?? 'n/a'}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>Last seen {formatTimestamp(device.lastSeenAt)}</div>
                <div style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>{device.deviceUuid}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ color: '#355372', fontSize: 13 }}>Status: {device.enrollmentStatus}</div>
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
        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
          <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Live desktop monitor</h2>
            <p style={{ margin: 0, color: '#5f7288', lineHeight: 1.7 }}>
              Recent laptop activity from enrolled XEEMS desktop agents. This feed refreshes automatically every 30 seconds.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {state.desktopActivity.length === 0 ? <div style={{ color: '#5f7288' }}>No desktop activity captured yet.</div> : null}
            {state.desktopActivity.map((entry) => (
              <div key={entry.id} style={{ borderRadius: 18, padding: 16, background: '#f9fbfd', border: '1px solid #d5e2ee', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{entry.appName}</div>
                  <div style={{ color: entry.isProductive ? '#86efac' : '#fbbf24', fontWeight: 700 }}>{entry.category.replaceAll('_', ' ')}</div>
                </div>
                <div style={{ color: '#355372' }}>{entry.windowTitle}</div>
                <div style={{ color: '#5f7288', fontSize: 13 }}>{entry.workerName} | {entry.deviceName}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{formatTimestamp(entry.at)}</div>
              </div>
            ))}
          </div>
        </div>
        <SiteMap sites={state.sites} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Client/site registry</h2>
          <ul style={{ paddingLeft: 18 }}>
            {state.sites.length === 0 ? <li>No active sites configured.</li> : null}
            {state.sites.map((site) => (
              <li key={site.id} style={{ marginBottom: 14 }}>
                <strong>{site.name}</strong> | {site.clientName ?? 'No client name'}
                <div style={{ color: '#5f7288' }}>{site.addressLabel || 'Address not set yet'}</div>
                <div style={{ color: '#5f7288' }}>
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} | radius {site.radius}m | {site.timezone ?? 'America/Aruba'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
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

        <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 22, border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 18px 36px rgba(16,35,61,0.06)' }}>
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
