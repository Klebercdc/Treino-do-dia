import { syncExercisesWeekly } from '../src/lib/exercises/sync-core';

async function run() {
  const summary = await syncExercisesWeekly({
    mode: 'import',
    useStateFile: true,
    seedAliases: true,
    enrichMedia: true,
  });
  console.log(JSON.stringify({ success: true, type: 'exercise_import', summary }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ success: false, type: 'exercise_import_error', message: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
