import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { checkRateLimit } from '../../../../../lib/utils/serverRateLimit';
import { KroniaExerciseApplication } from '../../../../../lib/exercises/application';

function buildExerciseDetailsSuccessPayload(data: unknown, meta: Record<string, unknown> = {}) {
  return {
    success: true,
    type: 'exercise_details',
    message: 'Detalhes do exercício carregados com sucesso.',
    data,
    meta,
  };
}

function buildExerciseDetailsPartialPayload(message: string, data: unknown, meta: Record<string, unknown> = {}) {
  return {
    success: false,
    type: 'exercise_partial',
    message,
    data,
    meta,
  };
}

function buildExerciseDetailsErrorPayload(message: string, code: string, meta: Record<string, unknown> = {}, data: unknown = null) {
  return {
    success: false,
    type: 'exercise_error',
    message,
    error: { code },
    data,
    meta,
  };
}

function normalizeExerciseDetailsEnvelope(result: { status: 'success' | 'error'; data: unknown; meta: Record<string, unknown>; errors: Array<{ code: string; message: string }> }) {
  const meta = result.meta ?? {};
  const knownResolution = Number(meta?.confidenceScore ?? 0) >= 0.9;

  if (result.status === 'success' && result.data) {
    return buildExerciseDetailsSuccessPayload(result.data, { ...meta, knownResolution });
  }

  if (!result.data) {
    return buildExerciseDetailsErrorPayload(
      result.errors?.[0]?.message || 'Não foi possível carregar os detalhes do exercício.',
      result.errors?.[0]?.code || 'EXERCISE_ERROR',
      meta,
      null,
    );
  }

  return buildExerciseDetailsPartialPayload(
    result.errors?.[0]?.message || 'Não foi possível enriquecer os detalhes do exercício agora.',
    result.data,
    { ...meta, code: result.errors?.[0]?.code || 'EXERCISE_PARTIAL', knownResolution },
  );
}

function resolveExerciseDetailsHttpStatus(envelope: ReturnType<typeof normalizeExerciseDetailsEnvelope>) {
  if (envelope.success) return 200;
  if (envelope.type === 'exercise_partial') return 206;
  return ((envelope as any).error?.code === 'EXERCISE_NOT_FOUND') ? 404 : 422;
}

function normalizeLookupKey(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/[-\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function toTitleFromLookup(value: string) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type ExerciseDetailsFallbackInput = {
  exerciseId?: string;
  slug?: string;
  lookupKey?: string;
  exerciseName?: string;
  context?: unknown;
};

function buildFallbackExerciseDetails(input: ExerciseDetailsFallbackInput = {}, cause: unknown = null) {
  const rawName = String(input.exerciseName || input.lookupKey || input.slug || input.exerciseId || 'Exercício').trim();
  const safeName = toTitleFromLookup(rawName) || 'Exercício';
  const normalizedLookupKey = normalizeLookupKey(input.lookupKey || input.exerciseName || input.slug || safeName);
  const slug = String(input.slug || normalizedLookupKey.replace(/_/g, '-')).trim() || null;
  const causeMessage = cause instanceof Error ? cause.message : (cause ? String(cause) : 'unknown');

  return {
    id: input.exerciseId || `fallback-${normalizedLookupKey || 'exercise'}`,
    slug,
    names: {
      pt: safeName,
      en: safeName,
    },
    gif_url: null,
    media: {
      url: null,
      primary: null,
      thumbnailUrl: null,
      type: 'none',
      provider: 'fallback',
      confidenceScore: 0,
    },
    instructions: [
      'Execute o movimento com controle e amplitude segura.',
      'Mantenha postura estável durante toda a série.',
      'Ajuste a carga para preservar a técnica antes de aumentar intensidade.',
    ],
    target_muscle: null,
    secondary_muscles: [],
    body_part: null,
    equipment: null,
    variations: [],
    source: 'fallback',
    common_errors: [
      'Usar impulso em vez de controle.',
      'Perder a postura para tentar aumentar a carga.',
    ],
    breathing_tip: 'Expire na fase de esforço e inspire no retorno controlado.',
    range_of_motion: 'Use amplitude confortável e sem dor.',
    completeness_score: 35,
    media_confidence_score: 0,
    content_source: 'client_safe_fallback',
    last_enriched_at: null,
    quality_flags: ['fallback_details', 'api_enrichment_failed'],
    metadata: {
      cacheHit: false,
      externalFetch: false,
      responseTimeMs: 0,
      normalizedLookupKey,
      confidenceScore: 0,
      knownResolution: false,
      fallback: true,
      cause: causeMessage,
      context: input.context ?? null,
    },
  };
}

function buildResilientPartialResponse(input: ExerciseDetailsFallbackInput, error: unknown, method: 'GET' | 'POST') {
  const data = buildFallbackExerciseDetails(input, error);
  return NextResponse.json(
    buildExerciseDetailsPartialPayload(
      'Detalhes básicos carregados. O enriquecimento avançado ficou indisponível agora.',
      data,
      {
        code: 'EXERCISE_DETAILS_FALLBACK',
        resilient: true,
        fallback: true,
        method,
        cause: error instanceof Error ? error.message : 'unknown',
      },
    ),
    { status: 206 },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exerciseId = searchParams.get('id')?.trim() || '';
  const slug = searchParams.get('slug')?.trim() || '';
  const lookupKey = (searchParams.get('lookupKey') || searchParams.get('normalized_lookup_key') || '').trim();
  const exerciseName = searchParams.get('exerciseName')?.trim() || '';

  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok || !('user' in auth)) return auth.response;

    if (!exerciseId && !slug && !lookupKey && !exerciseName) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Informe id, slug, lookupKey ou exerciseName.', 'VALIDATION_ERROR'), { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();
    const service = new KroniaExerciseApplication(adminClient);
    const result = await service.getExerciseDetailsByName({
      userId: auth.user.id,
      exerciseId: exerciseId || undefined,
      slug: slug || undefined,
      normalizedLookupKey: lookupKey || undefined,
      exerciseName: exerciseName || lookupKey || slug || undefined,
      locale: 'pt',
    });

    const envelope = normalizeExerciseDetailsEnvelope(result);
    return NextResponse.json(envelope, { status: resolveExerciseDetailsHttpStatus(envelope) });
  } catch (error) {
    console.error('[kronia/exercises/details][GET] fallback resiliente:', error instanceof Error ? error.message : error);
    return buildResilientPartialResponse({ exerciseId, slug, lookupKey, exerciseName }, error, 'GET');
  }
}

export async function POST(req: NextRequest) {
  let fallbackInput: ExerciseDetailsFallbackInput = {};

  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok || !('user' in auth)) return auth.response;

    const userId = auth.user.id;
    const rateLimit = await checkRateLimit(userId, { max: 40, windowMs: 60000, category: 'ai_heavy_operation' });
    if (!rateLimit.allowed) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Muitas requisições. Tente novamente em instantes.', 'RATE_LIMIT', { retryAfterSec: rateLimit.retryAfterSec }), { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } });
    }

    const body = await req.json().catch(() => null);
    if (!body || (typeof body !== 'object')) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Payload inválido.', 'VALIDATION_ERROR'), { status: 400 });
    }

    fallbackInput = {
      exerciseId: typeof (body as any).exerciseId === 'string' ? (body as any).exerciseId.slice(0, 120) : undefined,
      slug: typeof (body as any).slug === 'string' ? (body as any).slug.slice(0, 240) : undefined,
      lookupKey: typeof (body as any).normalized_lookup_key === 'string'
        ? (body as any).normalized_lookup_key.slice(0, 240)
        : (typeof (body as any).normalizedLookupKey === 'string' ? (body as any).normalizedLookupKey.slice(0, 240) : undefined),
      exerciseName: typeof (body as any).exerciseName === 'string' ? (body as any).exerciseName.slice(0, 240) : undefined,
      context: (body as any).context,
    };

    const adminClient = createAdminSupabaseClient();
    const service = new KroniaExerciseApplication(adminClient);
    const result = await service.getExerciseDetailsByName({
      userId,
      exerciseId: fallbackInput.exerciseId,
      slug: fallbackInput.slug,
      normalizedLookupKey: fallbackInput.lookupKey,
      exerciseName: fallbackInput.exerciseName,
      locale: (body as any).locale === 'en' ? 'en' : 'pt',
      context: (body as any).context,
    });

    const envelope = normalizeExerciseDetailsEnvelope(result);
    if (envelope.success && Number((envelope as any)?.data?.completeness_score ?? 0) < 55) {
      console.info('[kronia_exercise] exercise_detail_low_value_detected', { key: (envelope as any)?.data?.slug, completeness: (envelope as any)?.data?.completeness_score });
    }
    return NextResponse.json(envelope, { status: resolveExerciseDetailsHttpStatus(envelope) });
  } catch (error) {
    console.error('[kronia/exercises/details][POST] fallback resiliente:', error instanceof Error ? error.message : error);
    return buildResilientPartialResponse(fallbackInput, error, 'POST');
  }
}
