import exerciseImport from '../src/server/internal/exerciseImport.js';

const BATCH_DELAY_MS = 200;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

function parsePositiveInteger(rawValue) {
  if (rawValue == null || rawValue === '') return null;
  const normalized = String(rawValue).trim();
  if (!POSITIVE_INTEGER_PATTERN.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
}

function getBatchSize() {
  const rawBatchSize = process.env.BATCH_SIZE;
  const parsed = parsePositiveInteger(rawBatchSize);

  if (rawBatchSize != null && rawBatchSize !== '' && parsed == null) {
    console.warn(
      `[import-exercises CLI] BATCH_SIZE inválido: "${rawBatchSize}". Usando fallback seguro: 200.`,
    );
    return 200;
  }

  return parsed == null ? 200 : parsed;
}

function getImportLimit() {
  const rawLimit = process.env.IMPORT_LIMIT;
  if (rawLimit == null || rawLimit === '') return null;

  const parsed = parsePositiveInteger(rawLimit);
  if (parsed == null) {
    throw new Error(`[import-exercises CLI] IMPORT_LIMIT inválido: "${rawLimit}". Use um inteiro positivo.`);
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
  console.error('[import-exercises CLI] Erro fatal:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
