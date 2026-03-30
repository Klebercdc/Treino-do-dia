import { NextResponse } from 'next/server';
import { getAIConfig, validateRuntimeEnv } from '../../../../lib/utils/env.server';

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
      ai: {
        provider: ai.provider,
      },
      timestamp: new Date().toISOString(),
    },
    { status: requiredMissing.length ? 503 : 200 },
  );
}
