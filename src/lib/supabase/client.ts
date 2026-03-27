import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../utils/env';

const config = getSupabaseConfig('client');

export const supabaseClient = createClient(config.url, config.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
