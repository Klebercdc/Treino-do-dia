import { NextResponse } from 'next/server';
import { getAIConfig, validateRuntimeEnv } from '../../../../lib/utils/env';

export async function GET() {
  const envStatus = validateRuntimeEnv();
  const ai = getAIConfig();

  const requiredMissing = envStatus.vars.filter((item) => ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].includes(item.key) && !item.found);

  return NextResponse.json(
    {
      status: requiredMissing.length ? 'degraded' : 'ok',
      version: '1.0.0',
      runtime: envStatus.runtime,
      source: envStatus.source,
      env: envStatus.vars,
      ai: {
        provider: ai.provider,
        chatKeyFound: !!ai.chatApiKey,
        embeddingsEnabled: ai.embeddingsEnabled,
      },
      timestamp: new Date().toISOString(),
    },
    { status: requiredMissing.length ? 503 : 200 },
  );
}
