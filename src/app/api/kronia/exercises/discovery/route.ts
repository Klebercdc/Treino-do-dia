import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { checkRateLimit } from '../../../../../lib/utils/serverRateLimit';
import { KroniaExerciseApplication } from '../../../../../lib/exercises/application';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const userId = auth.user.id;
    const rateLimit = checkRateLimit(userId, { max: 30, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ status: 'error', data: null, errors: [{ code: 'RATE_LIMIT', message: 'Too many requests' }], meta: {} }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.message || typeof body.message !== 'string') {
      return NextResponse.json({ status: 'error', data: null, errors: [{ code: 'VALIDATION_ERROR', message: 'message is required' }], meta: {} }, { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();
    const service = new KroniaExerciseApplication(adminClient);

    const result = await service.searchExercisesByContext({
      userId,
      message: body.message.slice(0, 1200),
      locale: body.locale === 'en' ? 'en' : 'pt',
      context: body.context,
    });

    const statusCode = result.status === 'success' ? 200 : 422;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('[kronia/exercises/discovery] erro interno:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        status: 'error',
        data: null,
        errors: [{ code: 'INTERNAL_ERROR', message: 'Falha ao processar descoberta de exercícios.' }],
        meta: {},
      },
      { status: 500 },
    );
  }
}
