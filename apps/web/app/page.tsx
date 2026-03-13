const activeWorkers = [
  { name: 'Maya', status: 'On shift', site: 'Warehouse A', lastSeen: '2 min ago' },
  { name: 'Luis', status: 'Traveling', site: 'Site 14', lastSeen: '1 min ago' },
  { name: 'Nina', status: 'Ended', site: 'Warehouse A', lastSeen: '18 min ago' }
];

const events = [
  { at: '11:40', label: 'Maya entered Warehouse A geofence' },
  { at: '11:37', label: 'Luis location ping synced' },
  { at: '11:12', label: 'Nina ended shift' }
];

const sites = [
  { name: 'Warehouse A', radius: '150m', workers: 4 },
  { name: 'Site 14', radius: '200m', workers: 2 }
];

export default function DashboardPage() {
  return (
    <main style={{ padding: 32, display: 'grid', gap: 20 }}>
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ color: '#7dd3fc', fontWeight: 700 }}>FIELDOPS CONSENT</div>
        <h1 style={{ margin: 0 }}>Admin dashboard scaffold</h1>
        <p style={{ margin: 0, color: '#94a3b8', maxWidth: 760 }}>
          Operational visibility for active work only. No covert monitoring, no off-shift tracking.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {[
          ['Active shifts', '12'],
          ['Geofence events today', '37'],
          ['Workers needing attention', '2']
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
            <div style={{ color: '#94a3b8' }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16 }}>
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2>Active workers</h2>
          <ul>
            {activeWorkers.map((worker) => (
              <li key={worker.name} style={{ marginBottom: 12 }}>
                <strong>{worker.name}</strong> — {worker.status} — {worker.site} — {worker.lastSeen}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2>Recent events</h2>
          <ul>
            {events.map((event) => (
              <li key={event.at + event.label} style={{ marginBottom: 12 }}>
                <strong>{event.at}</strong> — {event.label}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: '#111827', borderRadius: 16, padding: 20 }}>
          <h2>Sites</h2>
          <ul>
            {sites.map((site) => (
              <li key={site.name} style={{ marginBottom: 12 }}>
                <strong>{site.name}</strong> — radius {site.radius} — {site.workers} workers
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
