import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EXERCISES_FILE = resolve(process.cwd(), 'data/exercises.json');
const BATCH_DELAY_MS = 200;

function validateRequiredEnv() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(`Erro: variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`);
    process.exit(1);
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getBatchSize() {
  const rawBatchSize = process.env.BATCH_SIZE;

  if (!rawBatchSize) return 200;

  const parsed = Number.parseInt(rawBatchSize, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`BATCH_SIZE inválido: "${rawBatchSize}". Use um inteiro positivo.`);
  }

  return parsed;
}

function getExercisesFile() {
  const rawFile = process.env.EXERCISES_FILE;
  return rawFile ? resolve(process.cwd(), rawFile) : DEFAULT_EXERCISES_FILE;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function run() {
  const { supabaseUrl, serviceRoleKey } = validateRequiredEnv();
  const exercisesFile = getExercisesFile();
  const batchSize = getBatchSize();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const raw = await readFile(exercisesFile, 'utf8');
  const parsed = JSON.parse(raw);
  const exercises = Array.isArray(parsed) ? parsed : parsed?.exercises;

  if (!Array.isArray(exercises)) {
    throw new Error(`Formato inválido em ${exercisesFile}. Esperado array ou objeto com chave "exercises".`);
  }

  const batches = chunk(exercises, batchSize);

  console.log(
    `Iniciando importação: total=${exercises.length} exercícios, batchSize=${batchSize}, lotes=${batches.length}.`,
  );

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const batchNumber = index + 1;

    console.log(`Progresso: lote ${batchNumber}/${batches.length} (${batch.length} exercícios).`);

    try {
      const { error } = await supabase.rpc('import_exercises_json', { payload: batch });

      if (error) {
        console.error(`Erro no lote ${batchNumber}/${batches.length}: ${error.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(
        `Erro inesperado no lote ${batchNumber}/${batches.length}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exit(1);
    }

    console.log(`Sucesso: lote ${batchNumber}/${batches.length} concluído.`);

    if (batchNumber < batches.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const { count, error: countError } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Falha ao consultar total da tabela exercises: ${countError.message}`);
  }

  console.log(`Importação concluída com sucesso. Total atual na tabela exercises: ${count ?? 0}.`);
}

run().catch((error) => {
  console.error('Erro fatal na importação:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
