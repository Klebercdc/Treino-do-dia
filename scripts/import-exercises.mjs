import exerciseImport from '../src/server/internal/exerciseImport.js';

const BATCH_DELAY_MS = 200;

function getBatchSize() {
  const rawBatchSize = process.env.BATCH_SIZE;

  if (!rawBatchSize) return 200;

  const parsed = Number.parseInt(rawBatchSize, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`BATCH_SIZE inválido: "${rawBatchSize}". Use um inteiro positivo.`);
  }

  return parsed;
}

async function run() {
  const summary = await exerciseImport.runExerciseImport({
    batchSize: getBatchSize(),
    batchDelayMs: BATCH_DELAY_MS,
    exercisesFile: exerciseImport.getExercisesFile(),
    logger: (message) => console.log(message),
  });

  console.log(
    `Importação concluída com sucesso. Total atual na tabela exercises: ${summary.finalExercisesCount}.`,
  );
}

run().catch((error) => {
  console.error('Erro fatal na importação:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
