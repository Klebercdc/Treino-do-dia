import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EXERCISES_FILE = resolve(process.cwd(), 'data/exercises.json');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
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

async function run() {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
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

  console.log(`Iniciando importação de ${exercises.length} exercícios em ${batches.length} lote(s)...`);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const batchNumber = index + 1;

    console.log(`Enviando lote ${batchNumber}/${batches.length} (${batch.length} exercícios)...`);

    const { error } = await supabase.rpc('import_exercises_json', { payload: batch });

    if (error) {
      console.error(`Erro no lote ${batchNumber}:`, error.message);
      process.exit(1);
    }

    console.log(`Lote ${batchNumber}/${batches.length} concluído.`);
  }

  const { count, error: countError } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Falha ao consultar total da tabela exercises: ${countError.message}`);
  }

  console.log(`Importação concluída com sucesso. Total atual na tabela exercises: ${count ?? 0}`);
}

run().catch((error) => {
  console.error('Erro fatal na importação:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
