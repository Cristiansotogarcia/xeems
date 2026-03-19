import React, { useEffect, useState } from 'react';
import type { AgentStatus } from './global';

const logoSrc = new URL('../../assets/XEEMS_Logo.png', import.meta.url).href;

interface Activity {
  appName: string;
  windowTitle: string;
  category: string;
  isProductive: boolean;
  timestamp: string | Date;
}

interface IdleEvent {
  durationSeconds: number;
  startTime: string;
  endTime: string | null;
}

const defaultStatus: AgentStatus = {
  signedIn: false,
  requiresLogin: true,
  enrolled: false,
  monitoringAllowed: false,
  monitoringActive: false,
  userId: null,
  userName: null,
  userEmail: null,
  deviceId: null,
  deviceUuid: '',
  deviceName: null,
  lastSeenAt: null,
  agentMessage: 'Sign in once to enroll this company-owned laptop.',
  platform: 'win32'
};

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return 'n/a';
  }

  return new Date(value).toLocaleString();
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AgentStatus>(defaultStatus);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [lastIdleEvent, setLastIdleEvent] = useState<IdleEvent | null>(null);
  const [version, setVersion] = useState('1.0.0');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    let removeStatusListener = () => undefined;
    let removeActivityListener = () => undefined;
    let removeIdleListener = () => undefined;

    const bootstrap = async () => {
      if (!window.electronAPI) {
        return;
      }

      const [agentStatus, versionInfo] = await Promise.all([
        window.electronAPI.getAgentStatus(),
        window.electronAPI.getVersion()
      ]);

      setStatus(agentStatus);
      setVersion(versionInfo.version);

      removeStatusListener = window.electronAPI.onAgentStatus((nextStatus) => {
        setStatus(nextStatus);
      });

      removeActivityListener = window.electronAPI.onActivityUpdate((activity) => {
        setActivities((current) => [activity, ...current].slice(0, 60));
      });

      removeIdleListener = window.electronAPI.onIdleEvent((idleEvent) => {
        setLastIdleEvent(idleEvent);
      });
    };

    void bootstrap();

    return () => {
      removeStatusListener();
      removeActivityListener();
      removeIdleListener();
    };
  }, []);

  const handleLogin = async () => {
    if (!window.electronAPI) {
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginError('');
      const result = await window.electronAPI.login(email, password);
      if (!result.success) {
        setLoginError(result.error || 'Login failed.');
        return;
      }

      const nextStatus = await window.electronAPI.getAgentStatus();
      setStatus(nextStatus);
      setPassword('');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSyncNow = async () => {
    if (!window.electronAPI) {
      return;
    }

    const result = await window.electronAPI.syncNow();
    setSyncMessage(result.success ? 'Sync requested.' : result.error || 'Unable to sync.');
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const statusClass = status.monitoringAllowed && status.monitoringActive ? 'status-card status-card--active' : 'status-card status-card--locked';

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero__brand">
          <img className="hero__logo" src={logoSrc} alt="XEEMS" />
        </div>
        <div className="hero__eyebrow">XEEMS Desktop Agent</div>
        <h1>Managed company laptop monitoring</h1>
        <p>
          XEEMS stays active on company-owned laptops after enrollment. Employees receive written notification; they do not control the
          monitoring lifecycle from this app.
        </p>
        <div className="notice hero__notice">
          <strong>Admin access lives in the XEEMS web portal.</strong>
          <span>This desktop app is only for employee laptop enrollment and background monitoring.</span>
        </div>
      </header>

      {!status.signedIn || status.requiresLogin ? (
        <section className="panel panel--auth">
          <div className="panel__header">
            <h2>First-time enrollment</h2>
            <p>Sign in once with the employee account issued by an administrator. XEEMS will enroll this device and persist after restart.</p>
          </div>

          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="employee@company.com" />
          </label>

          <label className="field">
            <span>Temporary password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin-issued password" />
          </label>

          {loginError ? <div className="notice notice--error">{loginError}</div> : null}

          <button className="button button--primary" onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? 'Enrolling device...' : 'Sign in and enroll'}
          </button>

          <div className="notice">
            <strong>Written notification policy</strong>
            <span>XEEMS on this laptop operates under company-device notice, not in-app consent capture.</span>
          </div>
        </section>
      ) : (
        <>
          <section className={statusClass}>
            <div>
              <div className="status-pill">{status.monitoringAllowed && status.monitoringActive ? 'Monitoring active' : 'Monitoring locked'}</div>
              <h2>{status.agentMessage}</h2>
              <p>Closing this window does not stop XEEMS. Administrators control employee and device state centrally.</p>
            </div>
            <button className="button button--secondary" onClick={handleSyncNow}>
              Sync now
            </button>
          </section>

          <section className="stats">
            <article className="metric">
              <span>Employee</span>
              <strong>{status.userName ?? status.userEmail ?? 'Unknown'}</strong>
              <small>{status.userEmail ?? 'No email loaded'}</small>
            </article>
            <article className="metric">
              <span>Device</span>
              <strong>{status.deviceName ?? 'Company laptop'}</strong>
              <small>{status.deviceId ?? 'Pending enrollment'}</small>
            </article>
            <article className="metric">
              <span>Last device heartbeat</span>
              <strong>{formatTimestamp(status.lastSeenAt)}</strong>
              <small>{status.platform}</small>
            </article>
            <article className="metric">
              <span>Last idle event</span>
              <strong>{lastIdleEvent ? `${Math.floor(lastIdleEvent.durationSeconds / 60)}m ${lastIdleEvent.durationSeconds % 60}s` : 'No idle event yet'}</strong>
              <small>{lastIdleEvent ? formatTimestamp(lastIdleEvent.endTime ?? lastIdleEvent.startTime) : 'Waiting for activity'}</small>
            </article>
          </section>

          <section className="panel panel--device">
            <div className="panel__header">
              <h2>Managed endpoint details</h2>
              <p>Administrators can disable this device remotely. XEEMS version {version}.</p>
            </div>

            <div className="detail-grid">
              <div>
                <span className="detail-label">Device UUID</span>
                <div className="detail-value detail-value--mono">{status.deviceUuid || 'Unavailable'}</div>
              </div>
              <div>
                <span className="detail-label">Assigned email</span>
                <div className="detail-value">{status.userEmail ?? 'Unavailable'}</div>
              </div>
            </div>

            {syncMessage ? <div className="notice">{syncMessage}</div> : null}
          </section>

          <section className="panel panel--activity">
            <div className="panel__header">
              <h2>Recent activity</h2>
              <p>Window titles and app names captured by the managed background agent.</p>
            </div>

            <div className="activity-list">
              {activities.length === 0 ? (
                <div className="empty-state">No activity captured yet.</div>
              ) : (
                activities.map((activity, index) => (
                  <div key={`${activity.appName}-${index}-${String(activity.timestamp)}`} className="activity-item">
                    <div className={`activity-marker activity-marker--${activity.category}`} />
                    <div className="activity-copy">
                      <div className="activity-app">{activity.appName}</div>
                      <div className="activity-title">{activity.windowTitle || 'No window title'}</div>
                    </div>
                    <div className="activity-meta">
                      <div>{activity.category.replace('_', ' ')}</div>
                      <small>{formatTimestamp(activity.timestamp)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}

      <footer className="footer">XEEMS v{version} | Managed company device | Window close hides UI only</footer>
    </div>
  );
};

export default App;
