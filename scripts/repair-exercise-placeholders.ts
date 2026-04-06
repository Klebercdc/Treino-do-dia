import { createClient } from '@supabase/supabase-js';
import { resolveLocalCatalogMedia } from '../src/lib/exercises/local-catalog';

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
    .select('id,slug,name,name_pt,name_en,target_muscle,muscle_group,equipment,search_terms,gif_url,media_url,media_type,media_provider,thumbnail_url')
    .eq('is_active', true)
    .or('gif_url.ilike.%example.com%,gif_url.is.null');

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  let updated = 0;
  const misses: string[] = [];

  for (const row of rows) {
    const match = resolveLocalCatalogMedia({
      name: row.name_en || row.name_pt || row.name,
      slug: row.slug,
      normalizedLookupKey: row.slug ? String(row.slug).replace(/-/g, '_') : null,
      targetMuscle: row.target_muscle || row.muscle_group,
      equipment: row.equipment,
      searchTerms: Array.isArray(row.search_terms) ? row.search_terms : [],
    });

    if (!match?.gifUrl) {
      misses.push(String(row.name_en || row.name_pt || row.slug || row.id));
      continue;
    }

    const patch = {
      gif_url: match.gifUrl,
      media_type: row.media_url ? row.media_type : 'gif',
      media_provider: row.media_url ? row.media_provider : 'catalog',
      thumbnail_url: row.thumbnail_url || match.gifUrl,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase.from('exercises').update(patch).eq('id', row.id);
    if (updateError) throw updateError;
    updated += 1;
  }

  console.log(JSON.stringify({ scanned: rows.length, updated, misses }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
