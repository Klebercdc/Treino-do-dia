import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { getAIConfig, getSupabaseConfig, maskSecret, validateRuntimeEnv } from '../src/lib/utils/env.server';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

type Status = 'OK' | 'ERROR' | 'WARNING' | 'SKIPPED';

interface CheckResult {
  name: string;
  status: Status;
  summary: string;
  details?: Record<string, unknown>;
  error?: string;
  suggestion?: string;
}

const REQUIRED_TABLES = [
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
  'workouts',
  'workout_logs',
  'push_subscriptions',
] as const;

const REQUIRED_FUNCTIONS = [
  'get_recent_food_logs',
  'get_recent_hydration_logs',
  'get_latest_body_metrics',
] as const;

function print(result: CheckResult): void {
  const icon =
    result.status === 'OK' ? '✅' :
    result.status === 'WARNING' ? '⚠️' :
    result.status === 'SKIPPED' ? '⏭️' : '❌';
  console.log(`${icon} ${result.name}: ${result.summary}`);
  if (result.error) console.log(`   erro: ${result.error}`);
  if (result.suggestion) console.log(`   sugestão: ${result.suggestion}`);
}

function detectVarSource(key: string): 'env runtime' | '.env.local (not loaded)' | 'missing' {
  if (process.env[key]) return 'env runtime';
  if (existsSync('.env.local')) {
    const content = readFileSync('.env.local', 'utf8');
    if (new RegExp(`^${key}=`, 'm').test(content)) return '.env.local (not loaded)';
  }
  return 'missing';
}

function checkRuntimeEnv(): CheckResult {
  const status = validateRuntimeEnv();
  const vars = status.vars.map((item) => ({
    key: item.key,
    found: item.found ? 'found' : 'missing',
    source: detectVarSource(item.key),
    masked: item.valueMasked,
  }));

  console.log('\nRUNTIME ENV REPORT:');
  for (const item of vars) {
    console.log(`  - ${item.key}: ${item.found} | source: ${item.source}`);
  }
  console.log(`  - runtime: ${status.runtime}`);
  console.log(`  - source: ${status.source}`);

  const missing = vars.filter(
    (item) =>
      item.found === 'missing' &&
      ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GROQ_API_KEY'].includes(item.key),
  );

  return {
    name: 'runtime_env',
    status: missing.length ? 'ERROR' : 'OK',
    summary: missing.length
      ? 'Variáveis críticas ausentes ou não carregadas em runtime.'
      : 'Variáveis críticas carregadas em runtime.',
    details: { runtime: status.runtime, source: status.source, vars },
    suggestion:
      missing.length && status.runtime === 'local'
        ? 'Crie .env.local com SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e GROQ_API_KEY.'
        : undefined,
  };
}

async function checkSupabaseTables(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseConfig('server');
    const db = createClient(supabase.url, supabase.serviceRoleKey as string, {
      auth: { persistSession: false },
    });

    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const { error } = await db.from(table).select('id').limit(0);
      if (error && /does not exist|relation/i.test(error.message)) {
        missing.push(table);
      }
    }

    const hasScientificArticles = !missing.includes('scientific_articles') && !(await db.from('scientific_articles').select('id').limit(0)).error;
    const hasScientificTopics = !missing.includes('scientific_topics') && !(await db.from('scientific_topics').select('id').limit(0)).error;
    const hasScientificEvidence = !missing.includes('scientific_evidence') && !(await db.from('scientific_evidence').select('id').limit(0)).error;

    if (missing.length > 0) {
      return {
        name: 'supabase_tables',
        status: 'ERROR',
        summary: `${missing.length} tabela(s) ausente(s) no banco.`,
        error: `Missing: ${missing.join(', ')}`,
        suggestion: 'Execute sql/003_nutrition_schema.sql no Supabase SQL Editor.',
        details: { missing },
      };
    }

    if (!hasScientificArticles || !hasScientificTopics || !hasScientificEvidence) {
      return {
        name: 'supabase_tables',
        status: 'WARNING',
        summary: 'Tabelas principais existem, mas a base científica direta está incompleta.',
        details: {
          hasScientificArticles,
          hasScientificTopics,
          hasScientificEvidence,
        },
        suggestion: 'Garanta scientific_articles, scientific_topics e scientific_evidence para referência científica em chat e dieta.',
      };
    }

    return {
      name: 'supabase_tables',
      status: 'OK',
      summary: `Todas as ${REQUIRED_TABLES.length} tabelas obrigatórias e a base científica direta existem.`,
    };
  } catch (error) {
    return {
      name: 'supabase_tables',
      status: 'SKIPPED',
      summary: 'Check de tabelas pulado — env não carregada.',
      error: (error as Error).message,
    };
  }
}

async function checkSupabaseFunctions(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseConfig('server');
    const db = createClient(supabase.url, supabase.serviceRoleKey as string, {
      auth: { persistSession: false },
    });

    const missing: string[] = [];
    for (const fn of REQUIRED_FUNCTIONS) {
      const { error } = await db.rpc(fn, { p_user_id: '00000000-0000-0000-0000-000000000000', p_limit: 1 });
      if (error && /function.*does not exist/i.test(error.message)) {
        missing.push(fn);
      }
    }

    if (missing.length > 0) {
      return {
        name: 'supabase_functions',
        status: 'ERROR',
        summary: `${missing.length} função(ões) SQL ausente(s).`,
        error: `Missing: ${missing.join(', ')}`,
        suggestion: 'Execute sql/005_nutrition_functions.sql no Supabase SQL Editor.',
        details: { missing },
      };
    }

    return {
      name: 'supabase_functions',
      status: 'OK',
      summary: `Todas as ${REQUIRED_FUNCTIONS.length} funções SQL principais estão disponíveis.`,
    };
  } catch (error) {
    return {
      name: 'supabase_functions',
      status: 'SKIPPED',
      summary: 'Check de funções pulado — env não carregada.',
      error: (error as Error).message,
    };
  }
}

async function checkEmbeddings(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseConfig('server');
    const db = createClient(supabase.url, supabase.serviceRoleKey as string, {
      auth: { persistSession: false },
    });

    const { count: total, error: totalError } = await db
      .from('nutrition_knowledge_chunks')
      .select('*', { count: 'exact', head: true });

    if (totalError && /schema cache|relation|does not exist/i.test(totalError.message)) {
      const [articles, evidence] = await Promise.all([
        db.from('scientific_articles').select('*', { count: 'exact', head: true }),
        db.from('scientific_evidence').select('*', { count: 'exact', head: true }),
      ]);

      if (!articles.error && !evidence.error && Number(articles.count || 0) > 0 && Number(evidence.count || 0) > 0) {
        return {
          name: 'embeddings',
          status: 'OK',
          summary: 'Instância operando pela base científica direta; chunks/embeddings não são obrigatórios neste banco.',
          details: {
            scientificArticles: articles.count,
            scientificEvidence: evidence.count,
            referenceMode: 'scientific_tables',
          },
        };
      }

      return {
        name: 'embeddings',
        status: 'WARNING',
        summary: 'Stack RAG antiga ausente e base científica direta não confirmada.',
        error: totalError.message,
      };
    }

    if ((total ?? 0) === 0) {
      return {
        name: 'embeddings',
        status: 'WARNING',
        summary: 'Nenhum chunk de conhecimento cadastrado — RAG sem conteúdo.',
        suggestion: 'Ingira documentos via POST /functions/v1/ingest-nutrition-knowledge ou opere pela base científica direta.',
      };
    }

    const { count: nullCount } = await db
      .from('nutrition_knowledge_chunks')
      .select('*', { count: 'exact', head: true })
      .is('embedding', null);

    if ((nullCount ?? 0) > 0) {
      return {
        name: 'embeddings',
        status: 'ERROR',
        summary: `${nullCount}/${total} chunks sem embedding — busca semântica inoperante.`,
        suggestion: 'Execute o pipeline de geração de embeddings para popular a coluna embedding.',
        details: { total, nullCount },
      };
    }

    return {
      name: 'embeddings',
      status: 'OK',
      summary: `${total} chunks com embeddings populados — RAG operacional.`,
      details: { total },
    };
  } catch (error) {
    return {
      name: 'embeddings',
      status: 'SKIPPED',
      summary: 'Check de embeddings pulado — env não carregada.',
      error: (error as Error).message,
    };
  }
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(full)) out.push(full);
    }
  };
  walk(root);
  return out;
}

function checkSensitiveKeyLeak(): CheckResult {
  const frontendFiles = [
    ...listFiles('src/app'),
    ...listFiles('src/components'),
    ...listFiles('src/pages'),
  ].filter((f) => !f.includes('/api/'));

  const offenders: string[] = [];
  for (const file of frontendFiles) {
    const content = readFileSync(file, 'utf8');
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('GROQ_API_KEY')) {
      offenders.push(file);
    }
  }

  if (offenders.length) {
    return {
      name: 'frontend_secret_leak',
      status: 'ERROR',
      summary: 'Segredo detectado em camada frontend.',
      details: { offenders },
      suggestion: 'Mova leitura de segredo para backend/edge functions.',
    };
  }

  return {
    name: 'frontend_secret_leak',
    status: 'OK',
    summary: 'Nenhuma chave sensível detectada no frontend.',
  };
}


function checkApplicationLayerIntegrity(): CheckResult {
  const appFile = 'src/application/kronia-application.js';
  if (!existsSync(appFile)) {
    return {
      name: 'application_layer_integrity',
      status: 'ERROR',
      summary: 'Camada de aplicação central não encontrada.',
      suggestion: 'Crie src/application/kronia-application.js com os use-cases centrais.',
    };
  }

  const content = readFileSync(appFile, 'utf8');
  const requiredUseCases = [
    'resolveInitialRoute',
    'resolvePostLoginRoute',
    'completeOnboarding',
    'saveUserProfile',
    'generateWorkoutPlan',
    'generateDietPlan',
    'generateSupplementProtocol',
    'classifyChatIntent',
    'processChatMessage',
    'loadUserDashboard',
    'updatePlan',
    'approvePlan',
    'validateAccess',
    'resolveNextAction',
    'handleBusinessError',
  ];

  const missingUseCases = requiredUseCases.filter((useCase) => !content.includes(`${useCase}:`) && !content.includes(`function ${useCase}`));

  const requiredStates = [
    'visitor',
    'authenticated',
    'onboarding_pending',
    'onboarding_in_progress',
    'onboarding_completed',
    'plan_not_created',
    'plan_generating',
    'plan_generated',
    'plan_active',
    'plan_expired',
    'blocked',
  ];

  const missingStates = requiredStates.filter((state) => !content.includes(`'${state}'`));

  const hasResultContract = content.includes('status:') && content.includes('data:') && content.includes('errors:') && content.includes('nextAction:');

  if (missingUseCases.length || missingStates.length || !hasResultContract) {
    return {
      name: 'application_layer_integrity',
      status: 'ERROR',
      summary: 'Camada de aplicação incompleta ou fora do contrato.',
      details: { missingUseCases, missingStates, hasResultContract },
      suggestion: 'Implemente todos os use-cases obrigatórios e contrato padrão {status,data,errors,nextAction}.',
    };
  }

  return {
    name: 'application_layer_integrity',
    status: 'OK',
    summary: 'Use-cases centrais, estados e contrato padrão detectados na camada de aplicação.',
  };
}

function checkClientPrivilegeIsolation(): CheckResult {
  const rootFrontendFiles = ['auth.js', 'plans.js', 'krona-setup.js', 'fitflow-layout.js', 'app.js'].filter((file) => existsSync(file));
  const publicFiles = [
    'index.html',
    ...listFiles('src/app'),
    ...listFiles('src/components'),
    ...listFiles('src/pages'),
    ...listFiles('src/application'),
    ...rootFrontendFiles,
  ].filter((file, idx, arr) => !file.includes('node_modules') && arr.indexOf(file) === idx);
  const offenders: string[] = [];

  for (const file of publicFiles) {
    if (/^api\//.test(file) || file.includes('/supabase/functions/') || file.includes('/app/api/') || /route\.(ts|js)$/.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    if (content.includes('SERVICE_ROLE') || content.includes('service_role')) offenders.push(file);
  }

  return offenders.length
    ? {
        name: 'client_privilege_isolation',
        status: 'ERROR',
        summary: 'Referências a privilégios administrativos detectadas no client.',
        details: { offenders },
        suggestion: 'Remova SERVICE_ROLE do frontend e mantenha acesso sensível somente em backend/edge.',
      }
    : {
        name: 'client_privilege_isolation',
        status: 'OK',
        summary: 'Nenhuma referência a SERVICE_ROLE detectada em código de client.',
      };
}

async function checkAIProvider(): Promise<CheckResult> {
  const ai = getAIConfig();
  const details = {
    provider: ai.provider,
    chatModel: ai.chatModel,
    chatKey: maskSecret(ai.chatApiKey),
  };

  if (!ai.chatApiKey) {
    return {
      name: 'ai_provider',
      status: 'ERROR',
      summary: 'GROQ_API_KEY ausente no runtime.',
      details,
      suggestion: 'Defina GROQ_API_KEY no ambiente em que o script está rodando.',
    };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ai.chatApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ai.chatModel,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      return {
        name: 'ai_provider',
        status: 'ERROR',
        summary: 'GROQ_API_KEY encontrada, mas chamada ao Groq falhou.',
        error: `${response.status} ${await response.text()}`,
        details,
      };
    }

    return {
      name: 'ai_provider',
      status: 'OK',
      summary: 'Groq acessível, chave válida e resposta recebida.',
      details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const networkRestricted =
      /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ETIMEDOUT|EPERM/i.test(message);

    if (networkRestricted) {
      return {
        name: 'ai_provider',
        status: 'SKIPPED',
        summary: 'Check remoto do Groq pulado por indisponibilidade de rede no ambiente atual.',
        error: message,
        details,
        suggestion: 'Rode este check em ambiente com acesso externo para validar conectividade e chave.',
      };
    }

    return {
      name: 'ai_provider',
      status: 'ERROR',
      summary: 'Falha de runtime ao chamar o Groq.',
      error: message,
      details,
    };
  }
}

async function run(): Promise<void> {
  console.log('🔍 KRONIA System Check\n');

  const results: CheckResult[] = [];

  for (const step of [
    checkRuntimeEnv(),
    checkSensitiveKeyLeak(),
    checkApplicationLayerIntegrity(),
    checkClientPrivilegeIsolation(),
    checkSupabaseTables(),
    checkSupabaseFunctions(),
    checkEmbeddings(),
    checkAIProvider(),
  ]) {
    const result = await Promise.resolve(step);
    results.push(result);
    print(result);
  }

  const hasError = results.some((r) => r.status === 'ERROR');
  const hasWarning = results.some((r) => r.status === 'WARNING');
  const overall = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'OK';

  console.log(`\nSTATUS GERAL: ${overall}`);
  process.exit(hasError ? 1 : 0);
}

run().catch((error) => {
  console.error('❌ Falha fatal no system-check:', error);
  process.exit(1);
});
