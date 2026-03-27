import { getAIConfig, getSupabaseConfig, validateRuntimeEnv } from '../utils/env';
import { CheckContext, CheckResult } from './types';

export function runEnvCheck(): { context?: CheckContext; result: CheckResult } {
  const runtime = validateRuntimeEnv();
  const missing = runtime.vars.filter((item) => ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].includes(item.key) && !item.found);

  if (missing.length) {
    return {
      result: {
        name: 'ambiente',
        status: 'ERROR',
        summary: 'Variáveis Supabase ausentes no runtime.',
        error: `Missing: ${missing.map((m) => m.key).join(', ')}`,
        suggestion: runtime.runtime === 'local'
          ? 'As envs podem estar apenas na Vercel. Para check local, replique em .env.local.'
          : 'Revise variáveis no runtime atual.',
      },
    };
  }

  const supabase = getSupabaseConfig('server');
  const ai = getAIConfig();

  return {
    context: {
      supabaseUrl: supabase.url,
      anonKey: supabase.anonKey,
      serviceRoleKey: supabase.serviceRoleKey as string,
      aiApiKey: ai.chatApiKey,
      aiChatModel: ai.chatModel,
      aiEmbeddingModel: ai.embeddingModel,
    },
    result: {
      name: 'ambiente',
      status: 'OK',
      summary: 'Variáveis mínimas de runtime carregadas.',
      details: { runtime: runtime.runtime, source: runtime.source, aiProvider: ai.provider },
    },
  };
}
