import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { KroniaExerciseApplication } from '../../../../../lib/exercises/application';
import { syncExercisesWeekly } from '../../../../../lib/exercises/sync-core';

function isAdminEmail(email?: string | null): boolean {
  const allowlist = String(process.env.KRONIA_ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

async function ensureAdmin(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (!auth.ok) return null;
  if (isAdminEmail(auth.user.email)) return auth.user;
  return null;
}

export async function GET(req: NextRequest) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Não autorizado.', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  try {
    const app = new KroniaExerciseApplication(createAdminSupabaseClient());
    const summary = await app.getCatalogAdminSummary();
    console.info('[kronia_exercise] exercise_catalog_admin_summary_loaded', summary);

    return NextResponse.json({
      success: true,
      type: 'exercise_catalog_admin',
      message: 'Resumo do catálogo carregado.',
      data: {
        badges: [
          { key: 'video', label: 'Com vídeo', value: summary.withVideo },
          { key: 'gif', label: 'Com GIF', value: summary.withGif },
          { key: 'text_only', label: 'Apenas texto', value: summary.textOnly },
          { key: 'low_completeness', label: 'Baixa completude', value: summary.lowCompleteness, tone: summary.lowCompleteness > 0 ? 'warning' : 'ok' },
          { key: 'low_media_confidence', label: 'Mídia baixa confiança', value: summary.lowMediaConfidence, tone: summary.lowMediaConfidence > 0 ? 'warning' : 'ok' },
          { key: 'low_content_value', label: 'Baixo valor didático', value: summary.lowContentValue, tone: summary.lowContentValue > 0 ? 'warning' : 'ok' },
          { key: 'known_without_instructions', label: 'Conhecidos sem instruções', value: summary.known_exercises_without_instructions, tone: summary.known_exercises_without_instructions > 0 ? 'warning' : 'ok' },
          { key: 'known_without_common_errors', label: 'Conhecidos sem erros', value: summary.known_exercises_without_common_errors, tone: summary.known_exercises_without_common_errors > 0 ? 'warning' : 'ok' },
        ],
        ...summary,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error('[kronia_exercise] catalog_admin_summary_error', reason);
    return NextResponse.json({ success: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Não autorizado.', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  try {
    console.info('[kronia_exercise] exercise_catalog_resync_triggered', { source: 'admin_manual' });
    const summary = await syncExercisesWeekly({ mode: 'sync', useStateFile: false, seedAliases: true, enrichMedia: true });
    return NextResponse.json({
      success: true,
      type: 'exercise_catalog_admin_resync',
      message: 'Ressincronização concluída.',
      data: { summary },
      meta: { event: 'exercise_catalog_resync_triggered' },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error('[kronia_exercise] catalog_admin_resync_error', reason);
    return NextResponse.json({ success: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
