import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabase/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { checkRateLimit } from '../../../../../lib/utils/serverRateLimit';
import { KroniaExerciseApplication } from '../../../../../lib/exercises/application';

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
    if (!body?.exerciseName || typeof body.exerciseName !== 'string') {
      return NextResponse.json({ status: 'error', data: null, errors: [{ code: 'VALIDATION_ERROR', message: 'exerciseName is required' }], meta: {} }, { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();
    const service = new KroniaExerciseApplication(adminClient);
    const result = await service.getExerciseDetailsByName({
      userId,
      exerciseName: body.exerciseName.slice(0, 240),
      locale: body.locale === 'en' ? 'en' : 'pt',
      context: body.context,
    });

    const statusCode = result.status === 'success' ? 200 : 422;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('[kronia/exercises/details] erro interno:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        status: 'error',
        data: null,
        errors: [{ code: 'INTERNAL_ERROR', message: 'Falha ao buscar detalhes do exercício.' }],
        meta: {},
      },
      { status: 500 },
    );
  }
}
