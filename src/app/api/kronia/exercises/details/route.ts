import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabase/server';
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
  if (result.status === 'success' && result.data) {
    return buildExerciseDetailsSuccessPayload(result.data, result.meta ?? {});
  }
  return buildExerciseDetailsPartialPayload(
    result.errors?.[0]?.message || 'Não foi possível enriquecer os detalhes do exercício agora.',
    result.data,
    { ...(result.meta ?? {}), code: result.errors?.[0]?.code || 'EXERCISE_PARTIAL' },
  );
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ status: 'error', data: null, errors: [{ code: 'UNAUTHORIZED', message: 'Unauthorized' }], meta: {} }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const userClient = createServerSupabaseClient(accessToken);
    const { data: userData, error: authError } = await userClient.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ status: 'error', data: null, errors: [{ code: 'UNAUTHORIZED', message: 'Unauthorized' }], meta: {} }, { status: 401 });
    }

    const userId = userData.user.id;
    const rateLimit = checkRateLimit(userId, { max: 40, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ status: 'error', data: null, errors: [{ code: 'RATE_LIMIT', message: 'Too many requests' }], meta: {} }, { status: 429 });
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
      normalizedLookupKey: typeof body.normalized_lookup_key === 'string' ? body.normalized_lookup_key.slice(0, 240) : undefined,
      exerciseName: typeof body.exerciseName === 'string' ? body.exerciseName.slice(0, 240) : undefined,
      locale: body.locale === 'en' ? 'en' : 'pt',
      context: body.context,
    });

    const envelope = normalizeExerciseDetailsEnvelope(result);
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
