'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Owner/admin accounts only. Employee logins belong in the mobile or desktop apps.');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setStatus('Signing in...');

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('No user returned from auth.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This dashboard is restricted to owner/admin accounts.');
      }

      setStatus(`Welcome ${profile.full_name}. Loading dashboard...`);
      router.push('/');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(circle at top, #12233d 0%, #09121f 45%, #050913 100%)' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 460, background: 'rgba(15, 23, 42, 0.92)', padding: 28, borderRadius: 24, display: 'grid', gap: 14, border: '1px solid rgba(148,163,184,0.14)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <img src="/xeems-logo.png" alt="XEEMS" style={{ width: 'min(340px, 76vw)', height: 'auto' }} />
        </div>
        <div style={{ color: '#7dd3fc', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Owner / Admin Login</div>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>Sign in to XEEMS</h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.7 }}>{status}</p>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@company.com" style={{ padding: 14, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" style={{ padding: 14, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
        <div style={{ color: '#cbd5e1', fontSize: 14 }}>Admins use this web portal. Employees use the XEEMS desktop or mobile app.</div>
        <button disabled={loading} style={{ padding: 14, borderRadius: 12, border: 0, background: '#38bdf8', fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in...' : 'Open dashboard'}
        </button>
      </form>
    </main>
  );
}
