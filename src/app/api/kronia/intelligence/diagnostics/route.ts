import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { createServerSupabaseClient } from '../../../../../lib/supabase/server';

async function resolveUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const accessToken = authHeader.replace('Bearer ', '').trim();
  const userClient = createServerSupabaseClient(accessToken);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function safeText(value: unknown, max = 200) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

export async function POST(req: Request) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 80) : [];
  if (!rows.length) return NextResponse.json({ success: true, ingested: 0 });

  const payload = rows.map((row: any) => ({
    user_id: safeText(row?.userId, 60) || user.id,
    module: safeText(row?.module, 80) || 'unknown',
    action: safeText(row?.action, 120) || 'unknown',
    event: safeText(row?.event, 32) || 'info',
    severity: safeText(row?.severity, 16) || 'LOW',
    problem_code: safeText(row?.problemCode, 120),
    problem_label: safeText(row?.problemLabel, 180),
    analysis: row?.analysis && typeof row.analysis === 'object' ? row.analysis : {},
    recommendation: row?.recommendation && typeof row.recommendation === 'object' ? row.recommendation : {},
    task: row?.task && typeof row.task === 'object' ? row.task : {},
    correlation_id: safeText(row?.correlationId, 120),
    source: safeText(row?.source, 80) || 'client',
    app_version: safeText(row?.appVersion, 40),
  }));

  const db = createAdminSupabaseClient();
  const { error } = await db.from('ai_diagnostics').insert(payload);
  if (error) {
    return NextResponse.json({ success: false, error: { code: 'INGEST_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, ingested: payload.length });
}
