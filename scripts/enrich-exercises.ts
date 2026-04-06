import { syncExercisesWeekly } from '../src/lib/exercises/sync-core';

async function run() {
  const summary = await syncExercisesWeekly({
    mode: 'sync',
    mediaOnly: true,
    useStateFile: false,
    seedAliases: true,
    enrichMedia: true,
    mediaBatchSize: Number(process.env.EXERCISE_MEDIA_BATCH_SIZE || 120),
    requestDelayMs: Number(process.env.EXERCISE_MEDIA_DELAY_MS || 120),
  });

  console.log(JSON.stringify({
    success: true,
    type: 'exercise_media_enrichment',
    message: 'Enriquecimento de mídia do catálogo concluído.',
    data: { summary },
  }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    type: 'exercise_media_enrichment_error',
    message: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
