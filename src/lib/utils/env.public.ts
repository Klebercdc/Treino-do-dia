export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) ? String(process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
  const anonKey = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : '';
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.');
  }
  return { url, anonKey };
}
