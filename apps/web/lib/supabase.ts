import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SUPABASE_URL, getRequiredEnv } from '@fieldops/shared';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
  getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);
