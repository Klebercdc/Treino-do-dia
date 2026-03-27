import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertServerOnlySecretNotPublic, getSupabaseConfig } from '../utils/env';

export function createAdminSupabaseClient(): SupabaseClient {
  assertServerOnlySecretNotPublic('SUPABASE_SERVICE_ROLE_KEY');
  const config = getSupabaseConfig('server');

  return createClient(config.url, config.serviceRoleKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
