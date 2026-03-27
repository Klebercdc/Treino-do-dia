import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Env ausente: ${name}`);
  return value;
}

export function createServerSupabaseClient(accessToken?: string): SupabaseClient {
  const url = getEnv('SUPABASE_URL');
  const anon = getEnv('SUPABASE_ANON_KEY');

  return createClient(url, anon, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceRoleClient(): SupabaseClient {
  const url = getEnv('SUPABASE_URL');
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
