export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'radial-gradient(circle at top, #12233d 0%, #09121f 45%, #050913 100%)',
        color: '#e2e8f0'
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center', display: 'grid', gap: 16 }}>
        <div style={{ color: '#f59e0b', fontSize: 13, letterSpacing: '0.24em', textTransform: 'uppercase' }}>XEEMS</div>
        <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.05 }}>Page not found</h1>
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.7 }}>
          The requested XEEMS dashboard page does not exist or is no longer available.
        </p>
        <a
          href="/login"
          style={{
            justifySelf: 'center',
            padding: '12px 18px',
            borderRadius: 999,
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700
          }}
        >
          Return to login
        </a>
      </div>
    </main>
  );
}
