import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabase/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { KroniaExerciseApplication } from '../../../../../lib/exercises/application';
import { syncExercisesWeekly } from '../../../../../lib/exercises/sync-core';

function isAdminEmail(email?: string | null): boolean {
  const allowlist = String(process.env.KRONIA_ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

async function ensureAdmin(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const accessToken = authHeader.replace('Bearer ', '').trim();
  const userClient = createServerSupabaseClient(accessToken);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  if (isAdminEmail(data.user.email)) return data.user;
  return null;
}

export async function GET(req: Request) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Não autorizado.', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const app = new KroniaExerciseApplication(createAdminSupabaseClient());
  const summary = await app.getCatalogAdminSummary();

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
      ],
      ...summary,
    },
  });
}

export async function POST(req: Request) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Não autorizado.', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const summary = await syncExercisesWeekly({ mode: 'sync', useStateFile: false, seedAliases: true, enrichMedia: true });
  return NextResponse.json({
    success: true,
    type: 'exercise_catalog_admin_resync',
    message: 'Ressincronização concluída.',
    data: { summary },
    meta: { event: 'exercise_catalog_resync_triggered' },
  });
}
