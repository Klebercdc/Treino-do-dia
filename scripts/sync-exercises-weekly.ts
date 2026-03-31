import { syncExercisesWeekly } from '../src/lib/exercises/sync-core';

async function run() {
  const summary = await syncExercisesWeekly({
    mode: 'sync',
    useStateFile: false,
    seedAliases: true,
    enrichMedia: true,
  });

  console.log(JSON.stringify({ success: true, type: 'sync_exercises', message: 'Sincronização semanal concluída.', data: { summary } }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ success: false, type: 'sync_exercises_error', message: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
