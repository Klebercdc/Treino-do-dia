import { createAdminSupabaseClient } from '../src/lib/supabase/admin';

async function run() {
  const db = createAdminSupabaseClient();

  const { data, error } = await db
    .from('exercise_media_cache')
    .select('id, exercise_id, provider, provider_media_id, approved, verified_score, search_query, created_at')
    .order('verified_score', { ascending: false })
    .limit(50);

  if (error) throw error;

  console.table((data ?? []).map((row) => ({
    id: row.id,
    exercise: row.exercise_id,
    provider: row.provider,
    approved: row.approved,
    score: row.verified_score,
    query: row.search_query,
    created_at: row.created_at,
  })));
}

run().catch((error) => {
  console.error('[review-exercise-media-cache] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
