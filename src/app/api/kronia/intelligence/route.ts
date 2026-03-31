import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../lib/supabase/admin';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';

function isAdminEmail(email?: string | null): boolean {
  const allowlist = String(process.env.KRONIA_ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

async function resolveUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const accessToken = authHeader.replace('Bearer ', '').trim();
  const userClient = createServerSupabaseClient(accessToken);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function sanitizeRow(row: any) {
  return {
    user_id: typeof row?.userId === 'string' ? row.userId : null,
    module: typeof row?.module === 'string' ? row.module.slice(0, 80) : 'unknown',
    action: typeof row?.action === 'string' ? row.action.slice(0, 120) : 'unknown',
    event: typeof row?.status === 'string' ? row.status.slice(0, 32) : 'info',
    severity: typeof row?.severity === 'string' ? row.severity.slice(0, 32) : 'low',
    problem_code: typeof row?.problemCode === 'string' ? row.problemCode.slice(0, 120) : null,
    problem_label: typeof row?.label === 'string' ? row.label.slice(0, 160) : null,
    analysis: row?.metadata ? JSON.stringify(row.metadata).slice(0, 2000) : null,
    recommendation: typeof row?.recommendation === 'string' ? row.recommendation.slice(0, 280) : null,
    task: row?.task ? JSON.stringify(row.task).slice(0, 1800) : null,
    correlation_id: typeof row?.correlationId === 'string' ? row.correlationId.slice(0, 100) : null,
    source: typeof row?.source === 'string' ? row.source.slice(0, 80) : 'client',
    app_version: typeof row?.metadata?.appVersion === 'string' ? row.metadata.appVersion.slice(0, 60) : null,
  };
}

export async function POST(req: Request) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const events = Array.isArray(body?.events) ? body.events.slice(0, 60) : [];
  if (!events.length) return NextResponse.json({ success: true, message: 'Nenhum evento para persistir.' });

  const rows = events.map((event) => sanitizeRow({ ...event, userId: event?.userId || user.id }));
  const db = createAdminSupabaseClient();
  const { error } = await db.from('kronia_intelligence_events').insert(rows);
  if (error) {
    return NextResponse.json({ success: false, error: { code: 'INGEST_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, ingested: rows.length });
}

export async function GET(req: Request) {
  const user = await resolveUser(req);
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity');
  const moduleFilter = searchParams.get('module');
  const route = searchParams.get('route');
  const correlationId = searchParams.get('correlationId');

  const db = createAdminSupabaseClient();
  let query = db.from('kronia_intelligence_events').select('*').order('created_at', { ascending: false }).limit(120);
  if (severity) query = query.eq('severity', severity);
  if (moduleFilter) query = query.eq('module', moduleFilter);
  if (route) query = query.ilike('analysis', `%"route":"${route}%`);
  if (correlationId) query = query.eq('correlation_id', correlationId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: { code: 'READ_FAILED', message: error.message } }, { status: 500 });
  }

  const moduleHealth = (data || []).reduce<Record<string, { total: number; errors: number }>>((acc, item: any) => {
    const key = item.module || 'unknown';
    if (!acc[key]) acc[key] = { total: 0, errors: 0 };
    acc[key].total += 1;
    if (item.event === 'error') acc[key].errors += 1;
    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    data: {
      summary: Object.keys(moduleHealth).map((key) => ({
        module: key,
        total: moduleHealth[key].total,
        errors: moduleHealth[key].errors,
        healthScore: Math.max(0, 100 - Math.round((moduleHealth[key].errors / Math.max(moduleHealth[key].total, 1)) * 100)),
      })),
      recentEvents: data || [],
      diagnostics: (data || []).filter((x: any) => x.problem_code).slice(0, 30),
      recommendations: (data || []).map((x: any) => x.recommendation).filter(Boolean).slice(0, 20),
      tasks: (data || []).map((x: any) => x.task).filter(Boolean).slice(0, 20),
    },
  });
}
