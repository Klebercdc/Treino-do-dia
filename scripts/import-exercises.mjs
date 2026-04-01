import exerciseImport from '../src/server/internal/exerciseImport.js';

const BATCH_DELAY_MS = 200;

function getBatchSize() {
  const rawBatchSize = process.env.BATCH_SIZE;

  if (!rawBatchSize) return 200;

  const parsed = Number.parseInt(rawBatchSize, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(
      `[import-exercises CLI] BATCH_SIZE inválido: "${rawBatchSize}". Usando fallback seguro: 200.`,
    );
    return 200;
  }

  return parsed;
}

async function run() {
  const rawLimit = process.env.IMPORT_LIMIT;
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : null;
  const dryRun = ['1', 'true', 'yes', 'on'].includes(String(process.env.DRY_RUN || '').toLowerCase());
  console.log(`Iniciando CLI import. dryRun=${dryRun} limit=${limit ?? 'null'} batchSize=${getBatchSize()}`);

  const summary = await exerciseImport.runExerciseImport({
    batchSize: getBatchSize(),
    batchDelayMs: BATCH_DELAY_MS,
    exercisesFile: exerciseImport.getExercisesFile(),
    limit: limit,
    dryRun: dryRun,
    requestedBy: 'cli',
    logger: (message) => console.log(message),
  });

  console.log(
    `Importação finalizada com status=${summary.status}, jobId=${summary.jobId}, totalInTable=${summary.totalInTable}.`,
  );
}

run().catch((error) => {
  console.error('Erro fatal na importação:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
