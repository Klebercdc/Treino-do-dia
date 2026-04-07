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
  let scientific = {
    articles: null as number | null,
    evidence: null as number | null,
    topics: null as number | null,
    exercisesActive: null as number | null,
    referenceMode: 'unknown' as 'unknown' | 'scientific_tables' | 'rag_legacy',
    error: null as string | null,
  };
  let labs = {
    parserConfigured: Boolean(process.env.EXAM_OCR_SERVICE_URL),
      ocrServiceUrlConfigured: Boolean(process.env.EXAM_OCR_SERVICE_URL),
    reports: null as number | null,
    analyzedReports: null as number | null,
    error: null as string | null,
  };
  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from('user_memory_recompute_jobs').select('user_id', { count: 'exact', head: true }).limit(1);
    if (error) {
      migration033Error = error.message;
    } else {
      migration033Applied = true;
    }

    const [articles, evidence, topics, exercises, reports, validReports] = await Promise.all([
      admin.from('scientific_articles').select('id', { count: 'exact', head: true }),
      admin.from('scientific_evidence').select('id', { count: 'exact', head: true }),
      admin.from('scientific_topics').select('id', { count: 'exact', head: true }),
      admin.from('exercises').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('lab_reports').select('id', { count: 'exact', head: true }),
      admin.from('lab_reports').select('id', { count: 'exact', head: true }).eq('status', 'analyzed'),
    ]);

    scientific = {
      articles: articles.count ?? null,
      evidence: evidence.count ?? null,
      topics: topics.count ?? null,
      exercisesActive: exercises.count ?? null,
      referenceMode: Number(articles.count || 0) > 0 && Number(evidence.count || 0) > 0 ? 'scientific_tables' : 'unknown',
      error: articles.error?.message || evidence.error?.message || topics.error?.message || exercises.error?.message || null,
    };
    labs = {
      parserConfigured: Boolean(process.env.EXAM_OCR_SERVICE_URL),
      ocrServiceUrlConfigured: Boolean(process.env.EXAM_OCR_SERVICE_URL),
      reports: reports.count ?? null,
      analyzedReports: validReports.count ?? null,
      error: reports.error?.message || validReports.error?.message || null,
    };
  } catch (error) {
    migration033Error = error instanceof Error ? error.message : 'unknown';
    scientific.error = error instanceof Error ? error.message : 'unknown';
    labs.error = error instanceof Error ? error.message : 'unknown';
  }

  const scientificReady = Number(scientific.articles || 0) > 0 && Number(scientific.evidence || 0) > 0 && scientific.referenceMode === 'scientific_tables' && !scientific.error;
  const status = requiredMissing.length || !migration033Applied || !scientificReady ? 'degraded' : 'ok';

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
      scientific,
      labs,
      timestamp: new Date().toISOString(),
    },
    { status: status === 'ok' ? 200 : 503 },
  );
}
