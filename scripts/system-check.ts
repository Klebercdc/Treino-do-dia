import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { getAIConfig, getSupabaseConfig, maskSecret, validateRuntimeEnv } from '../src/lib/utils/env';

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

function print(result: CheckResult): void {
  const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : result.status === 'SKIPPED' ? '⏭️' : '❌';
  console.log(`${icon} ${result.name}: ${result.summary}`);
  if (result.error) console.log(`   erro: ${result.error}`);
  if (result.suggestion) console.log(`   sugestão: ${result.suggestion}`);
}

function detectVarSource(key: string): 'env runtime' | '.env.local (not loaded)' | 'missing' {
  if (process.env[key]) return 'env runtime';
  if (existsSync('.env.local')) {
    const content = readFileSync('.env.local', 'utf8');
    const hasKey = new RegExp(`^${key}=`, 'm').test(content);
    if (hasKey) return '.env.local (not loaded)';
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
    console.log(`- ${item.key}: ${item.found} | source: ${item.source}`);
  }
  console.log(`- runtime: ${status.runtime}`);
  console.log(`- source: ${status.source}`);

  const missing = vars.filter((item) => item.found === 'missing' && ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GROQ_API_KEY'].includes(item.key));

  return {
    name: 'runtime_env',
    status: missing.length ? 'ERROR' : 'OK',
    summary: missing.length ? 'Variáveis críticas ausentes ou não carregadas em runtime.' : 'Variáveis críticas carregadas em runtime.',
    details: { runtime: status.runtime, source: status.source, vars },
    suggestion: missing.length && status.runtime === 'local'
      ? 'As envs podem existir na Vercel, mas este check está local. Crie/preencha .env.local com os mesmos valores.'
      : undefined,
  };
}

async function checkSupabaseSelectOne(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseConfig('server');
    const db = createClient(supabase.url, supabase.serviceRoleKey as string, { auth: { persistSession: false } });
    const { error } = await db.from('profiles').select('id').limit(1);

    if (error) {
      return {
        name: 'supabase_select_1',
        status: 'ERROR',
        summary: 'Falha de conectividade com Supabase na consulta de teste.',
        error: error.message,
        suggestion: 'Valide URL/keys e se as migrations já foram aplicadas.',
      };
    }

    return {
      name: 'supabase_select_1',
      status: 'OK',
      summary: 'Conexão com Supabase válida (consulta de teste executada).',
    };
  } catch (error) {
    return {
      name: 'supabase_select_1',
      status: 'SKIPPED',
      summary: 'Check de Supabase pulado por env não carregada.',
      error: (error as Error).message,
      suggestion: 'Garanta SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no runtime atual.',
    };
  }
}

function listFrontendFiles(root: string): string[] {
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
  const frontendFiles = [...listFrontendFiles('src/app'), ...listFrontendFiles('src/components'), ...listFrontendFiles('src/pages')];

  const offenders: string[] = [];
  for (const file of frontendFiles) {
    if (file.includes('/api/')) continue;
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
    ...listFrontendFiles('src/app'),
    ...listFrontendFiles('src/components'),
    ...listFrontendFiles('src/pages'),
    ...listFrontendFiles('src/application'),
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
  console.log(`AI CHECK provider: ${ai.provider} chatKey: ${ai.chatApiKey ? 'found' : 'missing'} model: ${ai.chatModel}`);

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
    return {
      name: 'ai_provider',
      status: 'ERROR',
      summary: 'Falha de runtime ao chamar o Groq.',
      error: error instanceof Error ? error.message : String(error),
      details,
    };
  }
}

async function run(): Promise<void> {
  const results: CheckResult[] = [];

  const steps: Array<Promise<CheckResult> | CheckResult> = [
    checkRuntimeEnv(),
    checkSensitiveKeyLeak(),
    checkApplicationLayerIntegrity(),
    checkClientPrivilegeIsolation(),
    checkSupabaseSelectOne(),
    checkAIProvider(),
  ];

  for (const step of steps) {
    const result = await Promise.resolve(step);
    results.push(result);
    print(result);
  }

  const hasError = results.some((result) => result.status === 'ERROR');
  const hasWarning = results.some((result) => result.status === 'WARNING');
  const overall = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'OK';

  console.log(`\nSTATUS GERAL: ${overall}`);
  console.log(JSON.stringify({ status: overall, results }, null, 2));
  process.exit(hasError ? 1 : 0);
}

run().catch((error) => {
  console.error('❌ Falha fatal no system-check:', error);
  process.exit(1);
});
