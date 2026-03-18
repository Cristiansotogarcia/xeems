import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SUPABASE_URL, getRequiredEnv } from '@fieldops/shared';
import { NextResponse } from 'next/server';

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
}

function getAnonKey() {
  return getRequiredEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  );
}

function getServiceRoleKey() {
  return getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAnonServerClient() {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createServiceRoleClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}

export async function requireAdminRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
    };
  }

  const anonClient = createAnonServerClient();
  const {
    data: { user },
    error: authError
  } = await anonClient.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: authError?.message ?? 'Unable to authenticate request.' }, { status: 401 })
    };
  }

  const serviceClient = createServiceRoleClient();
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || profile.is_active !== true) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    };
  }

  return {
    ok: true as const,
    serviceClient,
    user,
    profile
  };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

