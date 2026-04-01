import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 200;
const EXERCISES_FILE = '/data/exercises.json';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const raw = await readFile(EXERCISES_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const exercises = Array.isArray(parsed) ? parsed : parsed?.exercises;

  if (!Array.isArray(exercises)) {
    throw new Error(`Formato inválido em ${EXERCISES_FILE}. Esperado array ou objeto com chave "exercises".`);
  }

  const batches = chunk(exercises, BATCH_SIZE);

  console.log(`Iniciando importação de ${exercises.length} exercícios em ${batches.length} lote(s)...`);

  for (let index = 0; index < batches.length; index += 1) {
    const payload = batches[index];
    const batchNumber = index + 1;

    console.log(`Enviando lote ${batchNumber}/${batches.length} (${payload.length} exercícios)...`);

    const { error } = await supabase.rpc('import_exercises_json', { payload });

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
