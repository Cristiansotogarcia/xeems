export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#111827', padding: 24, borderRadius: 16 }}>
        <div style={{ color: '#7dd3fc', fontWeight: 700, marginBottom: 8 }}>ADMIN LOGIN SCAFFOLD</div>
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <p style={{ color: '#94a3b8' }}>
          Hook this form to Supabase auth. Restrict dashboard routes to admin role.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          <input placeholder="admin@company.com" style={{ padding: 14, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
          <button style={{ padding: 14, borderRadius: 12, border: 0, background: '#38bdf8', fontWeight: 700 }}>
            Send magic link
          </button>
        </div>
      </div>
    </main>
  );
}
