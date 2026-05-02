/**
 * Aplica a migração 052 no Supabase:
 * cria exercise_aliases, exercise_media_cache e exercise_search_logs.
 *
 * Uso:
 *   node scripts/apply-052-exercise-tables.mjs
 *
 * Variáveis necessárias (em .env.local ou no ambiente):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env.local se existir
const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const MIGRATION_FILE = resolve(__dirname, '../supabase/migrations/052_exercise_discovery_module.sql');
const TABLES = ['exercise_aliases', 'exercise_media_cache', 'exercise_search_logs'];

function getEnv(key) {
  const val = process.env[key]?.trim();
  if (!val) throw new Error(`Variável ${key} não configurada. Adicione ao .env.local ou ao ambiente.`);
  return val;
}

async function checkTable(url, key, table) {
  const res = await fetch(
    `${url}/rest/v1/${table}?limit=0`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  return res.ok;
}

async function execSQL(url, key, sql) {
  // Tenta via Management API (requer service_role)
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ sql }),
  });
  return { status: res.status, body: await res.text().catch(() => '') };
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Migração 052 — tabelas de exercícios');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!existsSync(MIGRATION_FILE)) {
    console.error(`Arquivo não encontrado: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  let url, key;
  try {
    url = getEnv('SUPABASE_URL').replace(/\/$/, '');
    key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  } catch (err) {
    console.error(`\nERRO: ${err.message}\n`);
    printManualInstructions();
    process.exit(1);
  }

  // Verifica quais tabelas já existem
  console.log('Verificando tabelas existentes...');
  const existing = [];
  const missing = [];
  for (const table of TABLES) {
    const ok = await checkTable(url, key, table);
    if (ok) {
      existing.push(table);
      console.log(`  ✅  ${table} — já existe`);
    } else {
      missing.push(table);
      console.log(`  ❌  ${table} — ausente`);
    }
  }

  if (missing.length === 0) {
    console.log('\nTodas as tabelas já existem. Nada a fazer.');
    process.exit(0);
  }

  console.log(`\nAplicando migração para: ${missing.join(', ')}`);

  const sql = readFileSync(MIGRATION_FILE, 'utf8');
  const { status, body } = await execSQL(url, key, sql);

  if (status === 200 || status === 204) {
    console.log('\nMigração aplicada com sucesso.');

    console.log('\nVerificando resultado...');
    let allOk = true;
    for (const table of TABLES) {
      const ok = await checkTable(url, key, table);
      console.log(`  ${ok ? '✅' : '❌'}  ${table}`);
      if (!ok) allOk = false;
    }

    if (allOk) {
      console.log('\nTodas as tabelas criadas. O botão VER exercício está operacional.');
    } else {
      console.log('\nAlgumas tabelas ainda ausentes. Aplique manualmente conforme abaixo.');
      printManualInstructions();
      process.exit(1);
    }
  } else {
    const notAvailable = status === 404 || /function.*does not exist|could not find/i.test(body);
    if (notAvailable) {
      console.log('\nexec_sql não disponível neste projeto Supabase.');
    } else {
      console.error(`\nFalha HTTP ${status}: ${body}`);
    }
    printManualInstructions();
    process.exit(1);
  }
}

function printManualInstructions() {
  console.log(`
Para aplicar manualmente:
  1. Acesse https://supabase.com/dashboard → seu projeto → SQL Editor
  2. Clique em "New query"
  3. Cole o conteúdo de:
       supabase/migrations/052_exercise_discovery_module.sql
  4. Clique em "Run"

Tabelas que serão criadas:
  • exercise_aliases
  • exercise_media_cache
  • exercise_search_logs
`);
}

run().catch(err => {
  console.error('\nErro inesperado:', err.message || err);
  process.exit(1);
});
