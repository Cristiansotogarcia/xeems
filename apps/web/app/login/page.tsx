'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Sign in with your XA Tech admin account.');
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
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This dashboard is restricted to owner/admin accounts.');
      }

      const name = profile.full_name?.trim() || profile.email?.trim() || 'admin';
      setStatus(`Welcome ${name}. Loading dashboard...`);
      router.push('/');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at top, rgba(14,165,233,0.12) 0%, rgba(249,250,251,0) 38%), linear-gradient(180deg, #f9fbfd 0%, #edf4fa 100%)'
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255, 255, 255, 0.96)',
          padding: 32,
          borderRadius: 28,
          display: 'grid',
          gap: 14,
          border: '1px solid rgba(148,163,184,0.18)',
          boxShadow: '0 30px 80px rgba(15, 23, 42, 0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <img src="/xeems-logo.png" alt="XEEMS" style={{ width: 'min(400px, 82vw)', height: 'auto' }} />
        </div>
        <div style={{ color: '#f97316', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>XA Tech Admin Portal</div>
        <h1 style={{ marginTop: 0, marginBottom: 0, color: '#10233d' }}>Sign in to XEEMS</h1>
        <p style={{ color: '#5f7288', lineHeight: 1.7 }}>{status}</p>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="owner@company.com"
          style={{ padding: 14, borderRadius: 14, border: '1px solid #c6d5e3', background: '#f9fbfd', color: '#10233d' }}
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Admin password"
          style={{ padding: 14, borderRadius: 14, border: '1px solid #c6d5e3', background: '#f9fbfd', color: '#10233d' }}
        />
        <div style={{ color: '#355372', fontSize: 14 }}>Admins use this portal. Employees use the XEEMS desktop or mobile app.</div>
        <button
          disabled={loading}
          style={{ padding: 14, borderRadius: 14, border: 0, background: '#1d62d1', color: '#fff', fontWeight: 700, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in...' : 'Open dashboard'}
        </button>
      </form>
    </main>
  );
}
