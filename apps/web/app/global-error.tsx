'use client';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#050913',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <main style={{ maxWidth: 560, textAlign: 'center', display: 'grid', gap: 16 }}>
          <div style={{ color: '#f59e0b', fontSize: 13, letterSpacing: '0.24em', textTransform: 'uppercase' }}>XEEMS</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.05 }}>Dashboard error</h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.7 }}>
            XEEMS could not render this screen. Retry the request or return to the login screen.
          </p>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>{error.message}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '12px 18px',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
            <a
              href="/login"
              style={{
                borderRadius: 999,
                padding: '12px 18px',
                background: '#1e293b',
                color: '#fff',
                fontWeight: 700
              }}
            >
              Go to login
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
