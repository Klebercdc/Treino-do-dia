import { createAdminSupabaseClient } from '../src/lib/supabase/admin';
import { KroniaExerciseApplication } from '../src/lib/exercises/application';

const SEED_QUERIES = [
  'barbell bench press chest',
  'dumbbell shoulder press',
  'barbell squat legs',
  'romanian deadlift',
  'lat pulldown back',
  'seated cable row',
  'barbell curl biceps',
  'triceps rope pushdown',
  'hip thrust glutes',
  'lunges legs',
];

async function run() {
  const db = createAdminSupabaseClient();
  const app = new KroniaExerciseApplication(db);

  for (const query of SEED_QUERIES) {
    const result = await app.searchExercisesByContext({
      userId: '00000000-0000-0000-0000-000000000000',
      message: `quero exercício ${query}`,
      locale: 'pt',
    });

    if (result.status === 'success') {
      console.log('[seed:exercise] ok:', result.data?.names.en);
    } else {
      console.warn('[seed:exercise] fail:', query, result.errors[0]?.message);
    }
  }
}

run().catch((error) => {
  console.error('[seed:exercise] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
