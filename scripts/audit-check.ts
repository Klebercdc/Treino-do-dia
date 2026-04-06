import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

type CheckStatus = 'OK' | 'WARNING' | 'ERROR' | 'SKIPPED';

type CheckResult = {
  name: string;
  status: CheckStatus;
  message?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_SERVICE_KEY
  || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY são obrigatórios.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results: CheckResult[] = [];

function add(r: CheckResult) {
  results.push(r);
  const icon = r.status === 'OK' ? '✅' : r.status === 'WARNING' ? '⚠️' : r.status === 'SKIPPED' ? '⏭️' : '❌';
  console.log(`${icon} ${r.name}${r.message ? ': ' + r.message : ''}`);
}

async function checkDatabase() {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    add({ name: 'DB', status: 'OK' });
  } catch (e: unknown) {
    add({ name: 'DB', status: 'ERROR', message: (e as Error).message });
  }
}

async function checkSchema() {
  const tables = [
    'profiles',
    'nutrition_goals',
    'meal_plans',
    'meal_plan_items',
    'user_food_logs',
    'hydration_logs',
    'body_metrics',
    'supplement_protocols',
    'ai_conversations',
    'ai_messages',
    'ai_context_logs',
    'ai_audit_logs',
    'scientific_articles',
    'scientific_topics',
    'scientific_evidence',
    'exercises',
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      add({ name: 'SCHEMA', status: 'ERROR', message: `Tabela '${t}' inacessível: ${error.message}` });
      return;
    }
  }

  add({ name: 'SCHEMA', status: 'OK', message: `${tables.length} tabelas acessíveis` });
}

async function checkTextSearch() {
  const { error } = await supabase.rpc('search_nutrition_knowledge', {
    search_query: 'proteína',
    match_count: 1,
    category_filter: null,
  });

  if (!error) {
    add({ name: 'TEXT_SEARCH', status: 'OK', message: 'Função search_nutrition_knowledge disponível.' });
    return;
  }

  if (/function.*does not exist|schema cache|relation/i.test(error.message)) {
    const [articles, evidence, topics] = await Promise.all([
      supabase.from('scientific_articles').select('*', { count: 'exact', head: true }),
      supabase.from('scientific_evidence').select('*', { count: 'exact', head: true }),
      supabase.from('scientific_topics').select('*', { count: 'exact', head: true }),
    ]);

    if (!articles.error && !evidence.error && !topics.error && Number(articles.count || 0) > 0 && Number(evidence.count || 0) > 0) {
      add({
        name: 'TEXT_SEARCH',
        status: 'OK',
        message: `Stack legada ausente, mas base científica direta ativa (${articles.count} artigos / ${evidence.count} evidências / ${topics.count} tópicos).`,
      });
      return;
    }
  }

  add({ name: 'TEXT_SEARCH', status: 'WARNING', message: error.message });
}

async function checkScientificCoverage() {
  const [exercises, articles, evidence] = await Promise.all([
    supabase.from('exercises').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('scientific_articles').select('*', { count: 'exact', head: true }),
    supabase.from('scientific_evidence').select('*', { count: 'exact', head: true }),
  ]);

  if (exercises.error || articles.error || evidence.error) {
    add({
      name: 'SCIENTIFIC_COVERAGE',
      status: 'WARNING',
      message: exercises.error?.message || articles.error?.message || evidence.error?.message || 'falha ao ler cobertura científica',
    });
    return;
  }

  const exercisesCount = Number(exercises.count || 0);
  const articlesCount = Number(articles.count || 0);
  const evidenceCount = Number(evidence.count || 0);

  const healthy = exercisesCount >= 1000 && articlesCount >= 20 && evidenceCount >= 20;
  add({
    name: 'SCIENTIFIC_COVERAGE',
    status: healthy ? 'OK' : 'WARNING',
    message: `${exercisesCount} exercícios ativos / ${articlesCount} artigos / ${evidenceCount} evidências`,
  });
}

async function checkAuditLogs() {
  const { error } = await supabase.from('ai_audit_logs').insert({
    event_type: 'audit_check',
    status: 'ok',
    details: { source: 'audit-check.ts', ts: new Date().toISOString() },
  });

  if (error) {
    add({ name: 'AUDIT_LOG', status: 'ERROR', message: error.message });
  } else {
    add({ name: 'AUDIT_LOG', status: 'OK' });
  }
}

async function run() {
  console.log('\n=== AUDIT CHECK ===\n');

  await checkDatabase();
  await checkSchema();
  await checkTextSearch();
  await checkScientificCoverage();
  await checkAuditLogs();

  const hasError = results.some((r) => r.status === 'ERROR');
  const hasWarning = results.some((r) => r.status === 'WARNING');
  const overall = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'OK';

  console.log(`\nSTATUS GERAL: ${overall}`);
  process.exit(hasError ? 1 : 0);
}

run().catch((e) => {
  console.error('❌ Falha fatal:', e);
  process.exit(1);
});