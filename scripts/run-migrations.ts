/**
 * KRONIA — Migration Runner
 *
 * Aplica todas as migrations SQL em ordem no Supabase.
 * Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 *
 * Uso:
 *   npx ts-node scripts/run-migrations.ts
 *   npx ts-node scripts/run-migrations.ts --dry-run   (apenas lista os arquivos)
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

const DRY_RUN = process.argv.includes('--dry-run');

const SQL_DIR = resolve(__dirname, '../sql');

const MIGRATION_ORDER = [
  '001_kronia_ai_schema.sql',
  '002_kronia_ai_rls.sql',
  '003_nutrition_schema.sql',
  '004_nutrition_rls.sql',
  '005_nutrition_functions.sql',
];

function getUrl(): string {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) throw new Error('SUPABASE_URL não configurada.');
  return url;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  return key;
}

async function applyMigration(
  db: ReturnType<typeof createClient>,
  filename: string,
  sql: string,
): Promise<void> {
  // Supabase JS não expõe execução arbitrária de SQL via SDK público.
  // Usamos a API REST do PostgREST /rpc via fetch direto ao endpoint SQL do Supabase.
  const url = getUrl();
  const key = getServiceRoleKey();

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

  // Se exec_sql não existir, instrui o usuário a aplicar manualmente
  if (res.status === 404 || res.status === 400) {
    const body = await res.text().catch(() => '');
    if (/function.*does not exist|could not find/i.test(body)) {
      console.warn(`  ⚠️  exec_sql não disponível — aplique ${filename} manualmente no SQL Editor.`);
      return;
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha ao aplicar ${filename}: ${res.status} ${body}`);
  }
}

async function run(): Promise<void> {
  console.log('🗄️  KRONIA Migration Runner\n');

  if (DRY_RUN) {
    console.log('Modo --dry-run: listando migrations sem aplicar.\n');
  }

  if (!existsSync(SQL_DIR)) {
    console.error(`❌  Pasta sql/ não encontrada em: ${SQL_DIR}`);
    process.exit(1);
  }

  // Verifica se há arquivos não mapeados na ordem
  const allFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
  const unmapped = allFiles.filter((f) => !MIGRATION_ORDER.includes(f));
  if (unmapped.length > 0) {
    console.warn(`⚠️  Arquivos SQL fora da ordem de migration: ${unmapped.join(', ')}`);
  }

  if (DRY_RUN) {
    console.log('Migrations que seriam aplicadas (em ordem):');
    for (const filename of MIGRATION_ORDER) {
      const filepath = join(SQL_DIR, filename);
      const exists = existsSync(filepath);
      console.log(`  ${exists ? '✅' : '❌'} ${filename}`);
    }
    return;
  }

  let url: string;
  let serviceKey: string;
  try {
    url = getUrl();
    serviceKey = getServiceRoleKey();
  } catch (err) {
    console.error(`❌  ${(err as Error).message}`);
    console.error('  Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou .env.local');
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  let applied = 0;
  let skipped = 0;

  for (const filename of MIGRATION_ORDER) {
    const filepath = join(SQL_DIR, filename);

    if (!existsSync(filepath)) {
      console.log(`  ⏭️  ${filename} — arquivo não encontrado, pulando.`);
      skipped++;
      continue;
    }

    const sql = readFileSync(filepath, 'utf8');
    console.log(`  ▶  Aplicando ${filename}...`);

    try {
      await applyMigration(db, filename, sql);
      console.log(`  ✅  ${filename} aplicado.`);
      applied++;
    } catch (err) {
      console.error(`  ❌  ${filename} falhou: ${(err as Error).message}`);
      console.error('\n  Para aplicar manualmente, cole o conteúdo do arquivo no Supabase SQL Editor:');
      console.error(`  https://supabase.com/dashboard → SQL Editor → New query`);
      process.exit(1);
    }
  }

  console.log(`\n✅  ${applied} migration(s) aplicada(s), ${skipped} pulada(s).`);

  if (applied > 0) {
    console.log('\nPróximos passos:');
    console.log('  1. Execute: npx ts-node scripts/system-check.ts');
    console.log('  2. Execute o pipeline de embeddings para popular nutrition_knowledge_chunks.embedding');
    console.log('  3. Após popular embeddings, crie o índice ivfflat comentado em sql/003 e sql/001');
  }
}

run().catch((err) => {
  console.error('❌  Falha fatal:', err);
  process.exit(1);
});
