#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const results = [];

function file(pathname) {
  return path.join(root, pathname);
}

function read(pathname) {
  const full = file(pathname);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

function hasAll(content, tokens) {
  return Boolean(content) && tokens.every((token) => content.includes(token));
}

function hasAny(content, tokens) {
  return Boolean(content) && tokens.some((token) => content.includes(token));
}

const files = {
  dietRouteHandler: 'src/server/apihelpers/_dietRouteHandler.js',
  trainingRecovery: 'src/server/apihelpers/_trainingRecoveryContext.js',
  dietTrainingContext: 'src/core/nutrition/diet_context_training.js',
  dietClinicalContext: 'src/core/nutrition/diet_context_clinical.js',
  dietService: 'src/services/diet/dietService.js',
  dietLabsBridge: 'src/ui/diet/diet-labs-bridge.js',
  labsBridge: 'src/ui/labs/home-labs-cta-bridge.js',
  staticBuild: 'scripts/build-static-public.mjs',
};

const src = Object.fromEntries(Object.entries(files).map(([key, pathname]) => [key, read(pathname)]));

console.log('\nKRONIA — verificação Dieta ↔ Exames ↔ Treino\n');

for (const [key, pathname] of Object.entries(files)) {
  check(`Arquivo existe: ${pathname}`, src[key] !== null);
}

check(
  'Exames reais: Dieta carrega bridge de Labs real',
  hasAll(src.dietLabsBridge, ['/api/kronia/labs/reports?limit=1', 'kronia_latest_lab_context', 'openLabsUploadScreen'])
);

check(
  'Exames reais: build publica diet-labs-bridge.js',
  hasAll(src.staticBuild, ['src/ui/diet/diet-labs-bridge.js'])
);

check(
  'Biomarcadores: contexto clínico preserva biomarkers e aiInsights',
  hasAll(src.dietClinicalContext, ['extractBiomarkersFromSource', 'biomarkers', 'aiInsights', 'clinicalFlags', 'criticalFlags'])
);

check(
  'Dieta: serviço usa biomarcadores reais na estratégia nutricional',
  hasAll(src.dietService, ['buildBiomarkerNutritionStrategy', 'labBiomarkerStrategy', 'biomarkerNutritionStrategy', 'biomarkersUsed'])
);

check(
  'TACO: dieta gera macros equivalentes pela tabela TACO',
  hasAll(src.dietService, ['tacoService', 'findBestTacoMatch', 'estimateNutritionFromTaco', 'tacoMacroAudit', 'macroSource'])
);

check(
  'Treino: helper busca fadiga, carga, PR, adaptação e histórico',
  hasAll(src.trainingRecovery, [
    'loadTrainingRecoveryContext',
    'fadiga_scores',
    'workout_logs',
    'workouts',
    'personal_records',
    'adaptation_events',
    'workout_history',
  ])
);

check(
  'Treino: helper calcula carga, recuperação e estratégia',
  hasAll(src.trainingRecovery, [
    'loadState',
    'avgRpe',
    'effectiveSetsLast7Days',
    'recoveryScore',
    'recoveryStatus',
    'recentPRCount',
    'needsDeload',
    'needsRecoveryFuel',
    'carbohydrateStrategy',
  ])
);

check(
  'Dieta: route handler injeta sinais de treino no payload',
  hasAll(src.dietRouteHandler, [
    '_trainingRecoveryContext',
    'loadTrainingRecoveryContext',
    'mergeTrainingRecovery',
    'contextoTreino',
    'trainingSnapshot',
    'adherenceContext',
  ])
);

check(
  'Dieta: normalizador entende fadiga, recuperação, PR e deload',
  hasAll(src.dietTrainingContext, [
    'normalizeTrainingSignals',
    'trainingRecovery',
    'recentPRs',
    'recentPRCount',
    'recoveryStatus',
    'recoveryScore',
    'needsDeload',
    'needsRecoveryFuel',
    'needsProteinDistribution',
  ])
);

check(
  'Dieta: fluxo segue recebendo contexto Supabase/exames',
  hasAny(src.dietRouteHandler, ['dietSupabaseContext.enrichDietRequestBody']) &&
    hasAny(src.dietClinicalContext, ['pickLabSource'])
);

function printResults(title, list) {
  console.log(title);
  list.forEach((item) => {
    const icon = item.ok ? '✅' : '❌';
    console.log(`${icon} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  });
  console.log('');
}

printResults('Checks estáticos de código:', results);

async function runDatabaseChecks() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('Checks do Supabase: pulado — defina SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para validar tabelas reais.\n');
    return [];
  }

  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch (error) {
    return [{ name: 'Supabase SDK disponível', ok: false, detail: error.message }];
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const tables = [
    'lab_reports',
    'fadiga_scores',
    'workout_logs',
    'workouts',
    'personal_records',
    'adaptation_events',
    'workout_history',
  ];

  const checks = [];
  for (const table of tables) {
    const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    checks.push({
      name: `Tabela Supabase acessível: ${table}`,
      ok: !error,
      detail: error ? error.message : `linhas: ${count ?? 'sem contagem'}`,
    });
  }
  return checks;
}

const dbResults = await runDatabaseChecks();
if (dbResults.length) printResults('Checks opcionais do Supabase:', dbResults);

const allResults = results.concat(dbResults);
const failed = allResults.filter((item) => !item.ok);

if (failed.length) {
  console.error(`Resultado: FALHOU — ${failed.length} check(s) não passaram.`);
  process.exit(1);
}

console.log('Resultado: OK — fluxo Dieta ↔ Exames ↔ Treino está conectado no código verificado.');
