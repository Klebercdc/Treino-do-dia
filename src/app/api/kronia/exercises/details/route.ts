import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { checkRateLimit } from '../../../../../lib/utils/serverRateLimit';
import { buildExerciseDetails, KroniaExerciseApplication } from '../../../../../lib/exercises/application';
import { ExerciseRepository } from '../../../../../lib/exercises/repository';

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
  if (result.status === 'success' && result.data) {
    return buildExerciseDetailsSuccessPayload(result.data, { ...(result.meta ?? {}), knownResolution: Number(result.meta?.confidenceScore ?? 0) >= 0.9 });
  }
  if (!result.data) {
    return buildExerciseDetailsErrorPayload(
      result.errors?.[0]?.message || 'Não foi possível carregar os detalhes do exercício.',
      result.errors?.[0]?.code || 'EXERCISE_ERROR',
      result.meta ?? {},
      null,
    );
  }
  return buildExerciseDetailsPartialPayload(
    result.errors?.[0]?.message || 'Não foi possível enriquecer os detalhes do exercício agora.',
    result.data,
    { ...(result.meta ?? {}), code: result.errors?.[0]?.code || 'EXERCISE_PARTIAL', knownResolution: Number(result.meta?.confidenceScore ?? 0) >= 0.9 },
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get('id')?.trim() || '';
    const slug = searchParams.get('slug')?.trim() || '';
    const lookupKey = (searchParams.get('lookupKey') || searchParams.get('normalized_lookup_key') || '').trim();

    if (!exerciseId && !slug && !lookupKey) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Informe id, slug ou lookupKey.', 'VALIDATION_ERROR'), { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();
    const repository = new ExerciseRepository(adminClient);

    const exercise = (exerciseId && await repository.findById(exerciseId))
      || (slug && await repository.findBySlug(slug))
      || (lookupKey && await repository.findByLookupKey(lookupKey));

    if (!exercise) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Exercício não encontrado.', 'EXERCISE_NOT_FOUND'), { status: 404 });
    }

    const enriched = await buildExerciseDetails(exercise);
    console.info('[kronia_exercise] exercise_details_enriched_returned', {
      id: enriched.id,
      slug: enriched.slug,
      normalizedLookupKey: enriched.metadata?.normalizedLookupKey,
    });

    return NextResponse.json(enriched, { status: 200 });
  } catch (error) {
    console.error('[kronia/exercises/details][GET] erro interno:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      buildExerciseDetailsErrorPayload('Falha ao buscar detalhes do exercício.', 'INTERNAL_ERROR', {
        cause: error instanceof Error ? error.message : 'unknown',
      }),
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;
    const rateLimit = await checkRateLimit(userId, { max: 40, windowMs: 60000, category: 'ai_heavy_operation' });
    if (!rateLimit.allowed) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Muitas requisições. Tente novamente em instantes.', 'RATE_LIMIT', { retryAfterSec: rateLimit.retryAfterSec }), { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } });
    }

    const body = await req.json().catch(() => null);
    if (!body || (typeof body !== 'object')) {
      return NextResponse.json(buildExerciseDetailsErrorPayload('Payload inválido.', 'VALIDATION_ERROR'), { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();
    const service = new KroniaExerciseApplication(adminClient);
    const result = await service.getExerciseDetailsByName({
      userId,
      exerciseId: typeof body.exerciseId === 'string' ? body.exerciseId.slice(0, 120) : undefined,
      slug: typeof body.slug === 'string' ? body.slug.slice(0, 240) : undefined,
      normalizedLookupKey: typeof body.normalized_lookup_key === 'string'
        ? body.normalized_lookup_key.slice(0, 240)
        : (typeof body.normalizedLookupKey === 'string' ? body.normalizedLookupKey.slice(0, 240) : undefined),
      exerciseName: typeof body.exerciseName === 'string' ? body.exerciseName.slice(0, 240) : undefined,
      locale: body.locale === 'en' ? 'en' : 'pt',
      context: body.context,
    });

    const envelope = normalizeExerciseDetailsEnvelope(result);
    if (envelope.success && Number((envelope as any)?.data?.completeness_score ?? 0) < 55) {
      console.info('[kronia_exercise] exercise_detail_low_value_detected', { key: (envelope as any)?.data?.slug, completeness: (envelope as any)?.data?.completeness_score });
    }
    const statusCode = envelope.success ? 200 : (envelope.type === 'exercise_partial' ? 206 : 422);
    return NextResponse.json(envelope, { status: statusCode });
  } catch (error) {
    console.error('[kronia/exercises/details] erro interno:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      buildExerciseDetailsErrorPayload(
        'Falha ao buscar detalhes do exercício.',
        'INTERNAL_ERROR',
        { cause: error instanceof Error ? error.message : 'unknown' },
      ),
      { status: 500 },
    );
  }
}
