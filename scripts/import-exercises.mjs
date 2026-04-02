import exerciseImport from '../src/server/internal/exerciseImport.js';

const BATCH_DELAY_MS = 200;
const DEFAULT_BATCH_SIZE = 200;

function parsePositiveInt(raw) {
  if (raw == null || raw === '') return null;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function getBatchSize() {
  const rawBatchSize = process.env.BATCH_SIZE;
  if (!rawBatchSize) return DEFAULT_BATCH_SIZE;

  const parsed = parsePositiveInt(rawBatchSize);
  if (parsed == null) {
    console.warn(`[import-exercises CLI] BATCH_SIZE inválido: "${rawBatchSize}". Usando fallback seguro: ${DEFAULT_BATCH_SIZE}.`);
    return DEFAULT_BATCH_SIZE;
  }

  return parsed;
}

function getLimitOrExit() {
  const rawLimit = process.env.IMPORT_LIMIT;
  if (!rawLimit) return null;

  const parsed = parsePositiveInt(rawLimit);
  if (parsed == null) {
    console.error(`[import-exercises CLI] IMPORT_LIMIT inválido: "${rawLimit}". Use um inteiro positivo.`);
    process.exit(1);
  }

  return parsed;
}

async function run() {
  const limit = getLimitOrExit();
  const dryRun = ['1', 'true', 'yes', 'on'].includes(String(process.env.DRY_RUN || '').toLowerCase());
  const batchSize = getBatchSize();

  console.log(`[import-exercises CLI] Iniciando import. dryRun=${dryRun} limit=${limit ?? 'null'} batchSize=${batchSize}`);

  const summary = await exerciseImport.runExerciseImport({
    batchSize,
    batchDelayMs: BATCH_DELAY_MS,
    exercisesFile: exerciseImport.getExercisesFile(),
    limit,
    dryRun,
    requestedBy: 'cli',
    logger: (message) => console.log(`[import-exercises CLI] ${message}`),
  });

  console.log(
    `[import-exercises CLI] Finalizado status=${summary.status} jobId=${summary.jobId} lotes=${summary.processedBatches}/${summary.totalBatches} importedOrUpdated=${summary.importedOrUpdated} totalInTable=${summary.totalInTable}`,
  );
}

run().catch((error) => {
  console.error('[import-exercises CLI] Erro fatal na importação:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
