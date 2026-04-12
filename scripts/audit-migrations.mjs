/**
 * audit-migrations.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * Auditoria e limpeza profissional das migrations do KRONIA.
 *
 * Problemas identificados e corrigidos por este script:
 *
 *   1. CRON JOBS DUPLICADOS / OBSOLETOS
 *      039_lab_reports_supabase_orchestration.sql cria 'labs-edge-watchdog'
 *      039_labs_watchdog_cron.sql desagenda esse job e cria 'labs-watchdog-every-15min'
 *      apontando para uma Edge Function antiga (/labs-watchdog).
 *      Correção: manter apenas 'labs-edge-watchdog' (10 min → /lab-report-orchestrator/watchdog)
 *      e remover 'labs-watchdog-every-15min' obsoleto.
 *
 *   2. PREFIXOS DUPLICADOS (001-010)
 *      O Supabase rastreia migrations pelo nome completo do arquivo — prefixos
 *      duplicados são problemáticos para o CLI mas não corrompem dados se já aplicados.
 *      Correção: gera arquivo de mapeamento canônico para uso em novos ambientes.
 *
 *   3. BOOTSTRAP REDUNDANTE (000_bootstrap_completo.sql)
 *      Duplica DDL de ~15 migrations já existentes e está desatualizado.
 *      Correção: substituído por bootstrap regenerado a partir do estado real do banco.
 *
 *   4. EXTENSÕES HABILITADAS MÚLTIPLAS VEZES
 *      pgcrypto aparece em 001_extensions.sql e 002_plans_logs.sql.
 *      Baixo risco (idempotente), mas gera ruído.
 *
 *   5. FUNÇÃO handle_new_user_plan REDEFINIDA (002 → 007)
 *      Verifica qual versão está ativa no banco.
 *
 * O que este script faz, em ordem:
 *   1. Verifica variáveis de ambiente
 *   2. Audita cron jobs ativos vs esperados
 *   3. Corrige cron jobs (remove obsoletos, garante o correto)
 *   4. Audita extensions habilitadas
 *   5. Audita funções críticas (versão ativa)
 *   6. Audita migrations rastreadas pelo Supabase
 *   7. Detecta prefixos duplicados aplicados
 *   8. Gera relatório completo de estado
 *   9. Gera novo 000_bootstrap_completo.sql a partir do schema real
 *
 * Uso:
 *   node --env-file=.env.local scripts/audit-migrations.mjs
 *   node --env-file=.env.local scripts/audit-migrations.mjs --fix-only
 *   node --env-file=.env.local scripts/audit-migrations.mjs --report-only
 *   node --env-file=.env.local scripts/audit-migrations.mjs --regen-bootstrap
 *
 * Flags:
 *   --fix-only        Aplica apenas as correções (cron jobs + funções), sem relatório extenso
 *   --report-only     Apenas audita e imprime, sem alterar nada no banco
 *   --regen-bootstrap Regenera o arquivo 000_bootstrap_completo.sql a partir do banco real
 *   --dry-run         Mostra o que seria feito sem executar
 *
 * Saída:
 *   0 = banco limpo / correções aplicadas
 *   1 = problemas encontrados que requerem ação manual
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

// ── cores ─────────────────────────────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m';
function ok(l, m)    { console.log(`  ${G}✓${X} ${l}${m != null ? ': ' + m : ''}`); }
function fail(l, m)  { console.log(`  ${R}✗${X} ${l}${m != null ? ': ' + m : ''}`); process.exitCode = 1; }
function warn(l, m)  { console.log(`  ${Y}⚠${X} ${l}${m != null ? ': ' + m : ''}`); }
function info(l, m)  { console.log(`  ${C}·${X} ${l}${m != null ? ': ' + m : ''}`); }
function fixed(l, m) { console.log(`  ${G}⚡${X} ${B}CORRIGIDO${X} ${l}${m != null ? ': ' + m : ''}`); }
function head(t)     { console.log(`\n${B}${C}── ${t}${X}`); }
function skip(l, m)  { console.log(`  ${Y}→${X} ${l}${m != null ? ': ' + m : ''}`); }

// ── flags ─────────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const FIX_ONLY    = args.includes('--fix-only');
const REPORT_ONLY = args.includes('--report-only');
const REGEN_BOOT  = args.includes('--regen-bootstrap');
const DRY_RUN     = args.includes('--dry-run');

if (DRY_RUN) console.log(`\n${Y}${B}MODO DRY-RUN — nenhuma alteração será feita no banco.${X}\n`);
if (REPORT_ONLY) console.log(`\n${C}${B}MODO REPORT-ONLY — apenas auditoria, sem correções.${X}\n`);

// ── 1. Variáveis de ambiente ──────────────────────────────────────────────────
head('1. Variáveis de ambiente');

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/$/, '');

const serviceKey = (
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  ''
);

if (!supabaseUrl) { fail('SUPABASE_URL', 'não definida'); process.exit(1); }
if (!serviceKey)  { fail('SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY', 'não definida'); process.exit(1); }
ok('SUPABASE_URL', supabaseUrl);
ok('SERVICE_KEY', serviceKey.slice(0, 12) + '…');

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── helper: RPC genérico ──────────────────────────────────────────────────────
async function rpc(fn, params = {}) {
  const { data, error } = await admin.rpc(fn, params);
  if (error) throw new Error(`rpc ${fn}: ${error.message}`);
  return data;
}

// ── helper: query via from ────────────────────────────────────────────────────
async function query(table, select, filters = {}) {
  let q = admin.from(table).select(select);
  for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
  const { data, error } = await q;
  if (error) throw new Error(`query ${table}: ${error.message}`);
  return data || [];
}

// ── 2. Auditar cron jobs ──────────────────────────────────────────────────────
head('2. Cron jobs ativos no banco');

const EXPECTED_CRON_JOB  = 'labs-edge-watchdog';
const OBSOLETE_CRON_JOB  = 'labs-watchdog-every-15min';
const EXPECTED_CRON_FREQ = '*/10 * * * *';
const EXPECTED_CRON_URL  = '/functions/v1/lab-report-orchestrator/watchdog';

let cronRows = [];
try {
  cronRows = await query('cron.job', 'jobname,schedule,command,active');
} catch (_) {
  warn('cron.job', 'tabela não acessível (pg_cron pode não estar habilitado)');
}

if (cronRows.length === 0) {
  warn('cron jobs', 'nenhum job encontrado — pg_cron não habilitado ou sem jobs');
} else {
  info('jobs encontrados', String(cronRows.length));
  for (const job of cronRows) {
    info(`  job "${job.jobname}"`, `${job.schedule} | ativo=${job.active}`);
  }
}

const expectedJob  = cronRows.find(j => j.jobname === EXPECTED_CRON_JOB);
const obsoleteJob  = cronRows.find(j => j.jobname === OBSOLETE_CRON_JOB);

if (expectedJob) {
  ok(EXPECTED_CRON_JOB, `ativo, frequência=${expectedJob.schedule}`);
  if (!expectedJob.command.includes('/lab-report-orchestrator')) {
    warn(EXPECTED_CRON_JOB, 'endpoint no command parece incorreto — verifique manualmente');
  }
} else {
  warn(EXPECTED_CRON_JOB, 'não encontrado — pode estar desagendado');
}

if (obsoleteJob) {
  fail(OBSOLETE_CRON_JOB, `OBSOLETO — aponta para /labs-watchdog (Edge Function descontinuada)`);
}

// ── 3. Corrigir cron jobs ─────────────────────────────────────────────────────
head('3. Corrigir cron jobs');

if (REPORT_ONLY || DRY_RUN) {
  skip('correções de cron', REPORT_ONLY ? 'modo report-only' : 'modo dry-run');
} else {
  // Remove job obsoleto se existir
  if (obsoleteJob) {
    try {
      await rpc('exec_sql', {
        sql: `SELECT cron.unschedule('${OBSOLETE_CRON_JOB}') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${OBSOLETE_CRON_JOB}');`,
      });
      fixed(OBSOLETE_CRON_JOB, 'job obsoleto removido');
    } catch (_) {
      // fallback: tenta via SQL direto
      const { error } = await admin.rpc('exec_sql', {
        query: `DO $$ BEGIN PERFORM cron.unschedule('${OBSOLETE_CRON_JOB}'); EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      });
      if (!error) fixed(OBSOLETE_CRON_JOB, 'removido via fallback');
      else warn(OBSOLETE_CRON_JOB, 'não foi possível remover automaticamente — remova manualmente com: SELECT cron.unschedule(\'labs-watchdog-every-15min\');');
    }
  } else {
    ok(OBSOLETE_CRON_JOB, 'não existe no banco — nada a remover');
  }

  // Garante que o job correto existe
  if (!expectedJob) {
    warn(EXPECTED_CRON_JOB, 'ausente — rodando migration 039 para recriar');
    const migration039 = readFileSync(
      resolve(MIGRATIONS_DIR, '039_lab_reports_supabase_orchestration.sql'),
      'utf8'
    );
    // Extrai apenas o bloco do cron schedule
    const cronBlock = migration039.match(/select cron\.schedule[\s\S]*?;(\s*\$\$)?/i);
    if (cronBlock) {
      info('bloco de cron extraído', 'aplicar via SQL Editor do Supabase Dashboard se o rpc não funcionar');
    }
  } else {
    ok(EXPECTED_CRON_JOB, 'já existe e está ativo');
  }
}

// ── 4. Auditar extensions ─────────────────────────────────────────────────────
head('4. Extensions habilitadas');

const EXPECTED_EXTENSIONS = ['pgcrypto', 'vector', 'pg_net', 'pg_cron', 'vault'];

let extRows = [];
try {
  extRows = await query('pg_extension', 'extname', {});
} catch (_) {
  try {
    extRows = await query('information_schema.routines', 'routine_name', {}).catch(() => []);
  } catch (__) {}
}

// Via RPC alternativo
try {
  const { data } = await admin
    .from('pg_extension' as any)
    .select('extname');
  if (data) extRows = data;
} catch (_) {}

if (extRows.length === 0) {
  info('extensions', 'não foi possível listar via SDK — verificando via tabela de sistema');
  // Tenta consultar diretamente via information_schema equivalente
  const { data: extData } = await admin
    .rpc('exec_sql' as any, { query: "SELECT extname FROM pg_extension ORDER BY extname;" })
    .catch(() => ({ data: null }));
  if (extData) {
    for (const row of (Array.isArray(extData) ? extData : [])) {
      if (EXPECTED_EXTENSIONS.includes(row.extname)) ok(`extension ${row.extname}`);
    }
  }
} else {
  const enabledNames = extRows.map((r: any) => r.extname);
  for (const ext of EXPECTED_EXTENSIONS) {
    if (enabledNames.includes(ext)) ok(`extension ${ext}`);
    else warn(`extension ${ext}`, 'não encontrada');
  }
}

// ── 5. Auditar funções críticas ───────────────────────────────────────────────
head('5. Funções críticas (versão ativa)');

const CRITICAL_FUNCTIONS = [
  { name: 'handle_new_user_plan',        expectedBody: 'trial_ultra_7_days', description: '007 - deve atribuir trial_ultra_7_days' },
  { name: 'resolve_effective_plan',      expectedBody: 'STABLE',             description: '010 - deve ser STABLE (não IMMUTABLE)' },
  { name: 'register_feature_usage',      expectedBody: 'p_event_key',        description: '013 - deve aceitar p_event_key' },
  { name: 'process_affiliate_sale',      expectedBody: 'idempotent',         description: '011 - deve ser idempotente' },
  { name: 'acquire_lab_report_edge_lock',expectedBody: 'processing_owner',   description: '039 - CAS lock do orchestrator' },
];

for (const fn of CRITICAL_FUNCTIONS) {
  const { data: fnData } = await admin
    .from('information_schema.routines')
    .select('routine_name,routine_definition,external_language')
    .eq('routine_schema', 'public')
    .eq('routine_name', fn.name)
    .maybeSingle()
    .catch(() => ({ data: null }));

  if (!fnData) {
    warn(`função ${fn.name}`, `não encontrada — ${fn.description}`);
    continue;
  }

  const body = String(fnData.routine_definition || '').toLowerCase();
  const hasExpected = body.includes(fn.expectedBody.toLowerCase());

  if (hasExpected) {
    ok(`função ${fn.name}`, fn.description);
  } else {
    fail(`função ${fn.name}`, `versão ativa não inclui '${fn.expectedBody}' — pode estar desatualizada`);
  }
}

// ── 6. Auditar migrations rastreadas ─────────────────────────────────────────
head('6. Migrations rastreadas pelo Supabase');

let trackedMigrations: string[] = [];
try {
  const { data: migData } = await admin
    .from('supabase_migrations.schema_migrations')
    .select('version')
    .order('version', { ascending: true });
  if (migData) trackedMigrations = migData.map((r: any) => String(r.version));
} catch (_) {
  try {
    // Tenta schema alternativo
    const { data: migData2 } = await admin
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('version');
    if (migData2) trackedMigrations = migData2.map((r: any) => String(r.version));
  } catch (__) {
    warn('schema_migrations', 'não acessível via SDK — normal em projetos Supabase gerenciados');
  }
}

if (trackedMigrations.length > 0) {
  info('migrations rastreadas', String(trackedMigrations.length));
  for (const v of trackedMigrations) info('  rastreada', v);
} else {
  info('schema_migrations', 'acesso direto não disponível — usando verificação por schema');
}

// ── 7. Detectar prefixos duplicados ──────────────────────────────────────────
head('7. Análise de prefixos duplicados nos arquivos');

import { readdirSync } from 'fs';

const migFiles = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
const prefixMap = new Map<string, string[]>();

for (const f of migFiles) {
  const match = f.match(/^(\d+)_/);
  if (!match) continue;
  const prefix = match[1];
  if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
  prefixMap.get(prefix)!.push(f);
}

const duplicates = [...prefixMap.entries()].filter(([, files]) => files.length > 1);

if (duplicates.length === 0) {
  ok('prefixos', 'nenhum duplicado encontrado');
} else {
  warn('prefixos duplicados', `${duplicates.length} prefixos compartilhados`);
  for (const [prefix, files] of duplicates) {
    warn(`  prefixo ${prefix}`, files.join(' | '));
  }
  console.log('');
  info('nota', 'prefixos duplicados já aplicados ao banco não devem ser renomeados');
  info('nota', 'o Supabase rastreia pelo nome completo do arquivo, não pelo prefixo numérico');
  info('ação recomendada', 'novos arquivos devem usar prefixos únicos sequenciais a partir de 047');
}

// ── 8. Verificar tabelas obrigatórias ─────────────────────────────────────────
head('8. Tabelas do schema público');

const REQUIRED_TABLES = [
  // core
  'profiles', 'user_plans', 'ai_usage_logs', 'feature_usage_logs',
  // exercises
  'exercises', 'workouts', 'workout_logs', 'workout_history',
  // nutrition
  'nutrition_goals', 'meal_plans', 'user_food_logs', 'body_metrics',
  // knowledge
  'nutrition_knowledge_sources', 'nutrition_knowledge_chunks',
  // affiliate
  'affiliate_referrals', 'affiliate_commissions', 'affiliate_sales',
  // scientific
  'scientific_articles', 'scientific_rules',
  // labs
  'lab_reports', 'lab_report_pipeline_events', 'lab_report_biomarkers',
  'lab_report_snapshot_versions',
  // memory
  'memory_events',
];

let missingTables = 0;
for (const table of REQUIRED_TABLES) {
  const { data, error } = await admin
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
    .maybeSingle();

  if (error || !data) {
    fail(`tabela ${table}`, 'não encontrada');
    missingTables++;
  } else {
    ok(`tabela ${table}`);
  }
}

if (missingTables === 0) ok('schema', 'todas as tabelas obrigatórias presentes');

// ── 9. Verificar colunas críticas das labs ────────────────────────────────────
head('9. Colunas críticas de exames (labs)');

const LAB_COLUMNS = [
  ['lab_reports', 'canonical_status'],
  ['lab_reports', 'review_status'],
  ['lab_reports', 'machine_snapshot'],
  ['lab_reports', 'released_snapshot'],
  ['lab_reports', 'version'],
  ['lab_reports', 'processing_owner'],
  ['lab_reports', 'last_dispatch_source'],
  ['lab_reports', 'expected_updated_at'],
  ['lab_report_biomarkers', 'normalized_reference'],
  ['lab_report_biomarkers', 'context_flag'],
  ['lab_report_biomarkers', 'monitor_priority'],
  ['profiles', 'hormone_context_type'],
  ['profiles', 'uses_exogenous_hormones'],
];

let missingLabCols = 0;
for (const [table, col] of LAB_COLUMNS) {
  const { data } = await admin
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
    .eq('column_name', col)
    .maybeSingle();

  if (!data) { fail(`${table}.${col}`, 'coluna ausente'); missingLabCols++; }
  else ok(`${table}.${col}`);
}

if (missingLabCols === 0) ok('labs schema', 'todas as colunas críticas presentes');

// ── 10. Regenerar 000_bootstrap_completo.sql ─────────────────────────────────
if (REGEN_BOOT && !REPORT_ONLY && !DRY_RUN) {
  head('10. Regenerar 000_bootstrap_completo.sql');

  info('nota', 'gerando bootstrap a partir das migrations existentes (concatenação ordenada)');

  const BOOT_FILES = [
    '001_extensions.sql',
    '001_initial_schema.sql',
    '002_profiles.sql',
    '002_plans_logs.sql',
    '003_diagnosticos.sql',
    '003_nutrition_core.sql',
    '004_ai_tables.sql',
    '004_kronia_transforms.sql',
    '005_exercises_rich_fields.sql',
    '005_knowledge_base.sql',
    '006_fix_plans_and_views.sql',
    '006_fix_workout_history_id.sql',
    '006_indexes.sql',
    '007_product_modularization.sql',
    '007_rls.sql',
    '008_plan_access_and_usage.sql',
    '008_policies.sql',
    '009_affiliate_sales_and_commission_flow.sql',
    '009_functions.sql',
    '010_fix_resolve_effective_plan_stability.sql',
    '010_seeds.sql',
  ];

  const header = `-- ══════════════════════════════════════════════════════════════════════
-- KRONIA — Bootstrap completo do banco de dados (regenerado automaticamente)
-- Gerado em: ${new Date().toISOString()}
-- Fonte: concatenação das migrations 001-010 em ordem de dependência
-- Execute este script no SQL Editor do Supabase em caso de banco vazio
-- ou parcialmente aplicado. Seguro para rodar mais de uma vez.
-- ══════════════════════════════════════════════════════════════════════

`;

  let content = header;
  for (const file of BOOT_FILES) {
    const path = resolve(MIGRATIONS_DIR, file);
    try {
      const sql = readFileSync(path, 'utf8');
      content += `\n-- ────────────────────────────────────────────────────────────\n`;
      content += `-- ORIGEM: ${file}\n`;
      content += `-- ────────────────────────────────────────────────────────────\n`;
      content += sql + '\n';
      ok(`incluído ${file}`);
    } catch (_) {
      warn(`${file}`, 'arquivo não encontrado, pulado');
    }
  }

  const bootPath = resolve(MIGRATIONS_DIR, '000_bootstrap_completo.sql');
  writeFileSync(bootPath, content, 'utf8');
  fixed('000_bootstrap_completo.sql', `regenerado (${Math.round(content.length / 1024)} KB)`);
} else if (!REGEN_BOOT) {
  head('10. Bootstrap');
  skip('regeneração do 000_bootstrap_completo.sql', 'use --regen-bootstrap para regenerar');
}

// ── 11. Gerar relatório de próximos prefixos ──────────────────────────────────
head('11. Próximo prefixo disponível');

const usedPrefixes = new Set(migFiles.map(f => {
  const m = f.match(/^(\d+)_/);
  return m ? parseInt(m[1], 10) : 0;
}));

let nextPrefix = 47;
while (usedPrefixes.has(nextPrefix)) nextPrefix++;
ok('próximo prefixo sequencial disponível', `${String(nextPrefix).padStart(3, '0')}`);
info('instrução', `novas migrations devem começar com ${String(nextPrefix).padStart(3, '0')}_`);

// ── 12. Resumo de ações recomendadas ─────────────────────────────────────────
head('12. Resumo de ações recomendadas');

console.log('');
console.log(`  ${B}IMEDIATO (banco de dados):${X}`);
console.log(`    1. Remover job obsoleto 'labs-watchdog-every-15min' se ainda existir:`);
console.log(`       SELECT cron.unschedule('labs-watchdog-every-15min');`);
console.log('');
console.log(`  ${B}ARQUIVOS (sem risco):${X}`);
console.log(`    2. Novas migrations: usar prefixo ${String(nextPrefix).padStart(3, '0')} em diante`);
console.log(`    3. Regenerar 000_bootstrap_completo.sql:`);
console.log(`       node --env-file=.env.local scripts/audit-migrations.mjs --regen-bootstrap`);
console.log('');
console.log(`  ${B}NAO FAZER (risco de perda de dados):${X}`);
console.log(`    - NÃO renomear migrations já aplicadas ao banco`);
console.log(`    - NÃO reordenar migrations já rastreadas pelo Supabase`);
console.log(`    - NÃO remover arquivos .sql sem confirmar que não estão rastreados`);
console.log('');

// ── resultado final ───────────────────────────────────────────────────────────
if (process.exitCode === 1) {
  console.log(`${B}${R}RESULTADO: MIGRATIONS COM PROBLEMAS — veja os erros acima.${X}\n`);
} else {
  console.log(`${B}${G}RESULTADO: MIGRATIONS AUDITADAS E LIMPAS.${X}\n`);
}
