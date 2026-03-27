import { CheckContext, CheckResult } from './types';

const FRONTEND_KEY_PATTERNS = [
  /NEXT_PUBLIC_.*SERVICE_ROLE/i,
  /VITE_.*SERVICE_ROLE/i,
  /REACT_APP_.*SERVICE_ROLE/i,
];

function looksLikeJwt(value: string): boolean {
  return value.split('.').length === 3;
}

export function buildCheckContextFromEnv(): { checkContext: CheckContext | null; result: CheckResult } {
  const startedAt = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  const formatIssues: string[] = [];
  if (supabaseUrl && !/^https:\/\/.+\.supabase\.co/.test(supabaseUrl) && !/^https?:\/\//.test(supabaseUrl)) {
    formatIssues.push('SUPABASE_URL não parece URL válida de projeto Supabase.');
  }
  if (anonKey && !looksLikeJwt(anonKey)) formatIssues.push('SUPABASE_ANON_KEY não possui formato JWT esperado.');
  if (serviceRoleKey && !looksLikeJwt(serviceRoleKey)) formatIssues.push('SUPABASE_SERVICE_ROLE_KEY não possui formato JWT esperado.');

  const leakedFrontendVars = Object.keys(process.env).filter((key) => FRONTEND_KEY_PATTERNS.some((regex) => regex.test(key)));

  const status = missing.length ? 'ERROR' : formatIssues.length || leakedFrontendVars.length ? 'WARNING' : 'OK';

  const description = missing.length
    ? `Variáveis obrigatórias ausentes: ${missing.join(', ')}`
    : 'Variáveis obrigatórias presentes e validadas.';

  const suggestion = missing.length
    ? 'Defina as variáveis ausentes no ambiente de execução antes de rodar o check.'
    : leakedFrontendVars.length
      ? 'Remova SERVICE_ROLE de variáveis públicas do frontend imediatamente.'
      : formatIssues.length
        ? 'Revise valores das chaves/URL no .env e no provedor de deploy.'
        : undefined;

  const result: CheckResult = {
    step: '1. Verificação de ambiente',
    status,
    description,
    details: {
      found: {
        SUPABASE_URL: Boolean(supabaseUrl),
        SUPABASE_ANON_KEY: Boolean(anonKey),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceRoleKey),
      },
      formatIssues,
      leakedFrontendVars,
    },
    suggestion,
    durationMs: Date.now() - startedAt,
  };

  if (missing.length) {
    return { checkContext: null, result };
  }

  return {
    checkContext: {
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      aiApiKey: process.env.AI_API_KEY,
      aiApiUrl: process.env.AI_API_URL ?? 'https://api.openai.com/v1',
      aiEmbeddingModel: process.env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      testUserPassword: process.env.SYSTEM_CHECK_TEST_USER_PASSWORD ?? 'SystemCheck#2026!',
    },
    result,
  };
}
