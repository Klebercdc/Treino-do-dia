import { NextResponse } from 'next/server';
import { getAIConfig, validateRuntimeEnv } from '../../../../lib/utils/env.server';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';

export async function GET() {
  const envStatus = validateRuntimeEnv();
  const ai = getAIConfig();

  const requiredMissing = envStatus.vars.filter((item) => ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].includes(item.key) && !item.found);
  const upstashRequired = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const upstash = {
    configured: upstashRequired.every((key) => Boolean(process.env[key])),
    missing: upstashRequired.filter((key) => !process.env[key]),
    prefix: process.env.RATE_LIMIT_PREFIX || 'kronia:ratelimit',
  };

  let migration033Applied = false;
  let migration033Error: string | null = null;
  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from('user_memory_recompute_jobs').select('user_id', { count: 'exact', head: true }).limit(1);
    if (error) {
      migration033Error = error.message;
    } else {
      migration033Applied = true;
    }
  } catch (error) {
    migration033Error = error instanceof Error ? error.message : 'unknown';
  }

  const status = requiredMissing.length || !migration033Applied ? 'degraded' : 'ok';

  return NextResponse.json(
    {
      status,
      version: '1.0.0',
      runtime: envStatus.runtime,
      source: envStatus.source,
      ai: {
        provider: ai.provider,
      },
      rateLimit: {
        distributedConfigured: upstash.configured,
        missing: upstash.missing,
        prefix: upstash.prefix,
      },
      memory: {
        migration033Applied,
        migration033Error,
        recomputeMode: 'hybrid_db_queue_in_process_worker',
      },
      timestamp: new Date().toISOString(),
    },
    { status: status === 'ok' ? 200 : 503 },
  );
}
