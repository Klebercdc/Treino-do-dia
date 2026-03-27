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

async function checkAIProvider(): Promise<CheckResult> {
  const ai = getAIConfig();
  console.log(
    `AI CHECK provider: ${ai.provider} status: ${ai.chatApiKey ? 'key-found' : 'key-missing'} chat key: ${ai.chatApiKey ? 'found' : 'missing'} embedding key: ${ai.embeddingsEnabled ? 'found' : 'missing'} embeddings: ${ai.embeddingsEnabled ? 'enabled' : 'skipped'}`,
  );

  const details = {
    provider: ai.provider,
    chatModel: ai.chatModel,
    chatKey: maskSecret(ai.chatApiKey),
    embeddingModel: ai.embeddingModel ?? 'missing',
    embeddings: ai.embeddingsEnabled ? 'enabled' : 'SKIPPED',
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

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  try {
    const response = await fetch(endpoint, {
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
        summary: 'GROQ_API_KEY encontrada, mas chamada ao provider falhou.',
        error: `${response.status} ${await response.text()}`,
        details,
      };
    }

    return {
      name: 'ai_provider',
      status: ai.embeddingsEnabled ? 'OK' : 'WARNING',
      summary: ai.embeddingsEnabled ? 'Provider Groq funcionando com embeddings configurados.' : 'Provider Groq funcionando; embeddings pulados com segurança.',
      details,
    };
  } catch (error) {
    return {
      name: 'ai_provider',
      status: 'ERROR',
      summary: 'Falha de runtime ao chamar provider Groq.',
      error: (error as Error).message,
      details,
    };
  }
}

async function run(): Promise<void> {
  const results: CheckResult[] = [];

  const steps: Array<Promise<CheckResult> | CheckResult> = [
    checkRuntimeEnv(),
    checkSensitiveKeyLeak(),
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
