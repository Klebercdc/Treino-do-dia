import { createClient } from '@supabase/supabase-js';

function readSupabaseUrl(): string {
  return process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.VITE_SUPABASE_URL
    ?? '';
}

function readSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_KEY
    ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.VITE_SUPABASE_SERVICE_KEY
    ?? '';
}

async function main() {
  const url = readSupabaseUrl();
  const key = readSupabaseServiceRoleKey();
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from('exercises')
    .select('id,gif_url,media_url,media_type,media_provider,thumbnail_url')
    .eq('is_active', true)
    .limit(2000);

  if (error) throw error;

  let updated = 0;
  for (const row of data || []) {
    const gif = String(row.gif_url || '').trim();
    const hasPlaceholder = /example\.com|placeholder/i.test(gif);
    if (!gif || hasPlaceholder) continue;

    const needsType = !row.media_type;
    const needsProvider = !row.media_provider;
    const needsThumb = !row.thumbnail_url;
    if (!needsType && !needsProvider && !needsThumb) continue;

    const patch = {
      media_type: row.media_type || (row.media_url ? row.media_type : 'gif'),
      media_provider: row.media_provider || (row.media_url ? row.media_provider : 'catalog'),
      thumbnail_url: row.thumbnail_url || gif,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase.from('exercises').update(patch).eq('id', row.id);
    if (updateError) throw updateError;
    updated += 1;
  }

  console.log(JSON.stringify({ scanned: (data || []).length, updated }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
