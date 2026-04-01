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

function getImportLimit() {
  const rawLimit = process.env.IMPORT_LIMIT;
  if (rawLimit == null || rawLimit === '') return null;

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(
      `[import-exercises CLI] IMPORT_LIMIT inválido: "${rawLimit}". Use um inteiro positivo.`,
    );
    process.exit(1);
  }

  return parsed;
}

async function run() {
  const limit = getImportLimit();
  const dryRun = ['1', 'true', 'yes', 'on'].includes(String(process.env.DRY_RUN || '').toLowerCase());
  const batchSize = getBatchSize();
  console.log(`Iniciando CLI import. dryRun=${dryRun} limit=${limit ?? 'null'} batchSize=${batchSize}`);

  const summary = await exerciseImport.runExerciseImport({
    batchSize,
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
