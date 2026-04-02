import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { analyzeEvents } from '../../../../core/intelligence/analysisEngine';
import { buildOperationalBacklog } from '../../../../core/intelligence/decisionEngine';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';

function isAdminEmail(email?: string | null): boolean {
  const allowlist = String(process.env.KRONIA_ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

function safeText(value: unknown, max = 220) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function normalizeRow(row: any, fallbackUserId: string) {
  return {
    user_id: safeText(row?.userId, 64) || fallbackUserId,
    module: safeText(row?.module, 80) || 'unknown',
    action: safeText(row?.action, 120) || 'unknown',
    event: safeText(row?.event || row?.status, 32) || 'info',
    severity: String(safeText(row?.severity, 16) || 'LOW').toUpperCase(),
    problem_code: safeText(row?.problemCode, 120),
    problem_label: safeText(row?.problemLabel, 180),
    analysis: row?.analysis && typeof row.analysis === 'object' ? row.analysis : (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
    recommendation: row?.recommendation && typeof row.recommendation === 'object' ? row.recommendation : {},
    task: row?.task && typeof row.task === 'object' ? row.task : {},
    correlation_id: safeText(row?.correlationId, 120),
    source: safeText(row?.source, 80) || 'client',
    app_version: safeText(row?.appVersion, 60),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const body = await req.json().catch(() => null);
  const events = Array.isArray(body?.events) ? body.events.slice(0, 80) : [];
  if (!events.length) return NextResponse.json({ success: true, ingested: 0 });

  const rows = events.map((event: any) => normalizeRow(event, user.id));
  const db = createAdminSupabaseClient();
  const { error } = await db.from('kronia_intelligence_events').insert(rows);
  if (error) {
    return NextResponse.json({ success: false, error: { code: 'INGEST_FAILED', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, ingested: rows.length });
}

export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (!auth.ok || !isAdminEmail(auth.user.email)) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'overview';
  const severity = searchParams.get('severity');
  const moduleFilter = searchParams.get('module');
  const correlationId = searchParams.get('correlationId');

  const db = createAdminSupabaseClient();
  let query = db.from('kronia_intelligence_events').select('*').order('created_at', { ascending: false }).limit(220);
  if (severity) query = query.eq('severity', severity.toUpperCase());
  if (moduleFilter) query = query.eq('module', moduleFilter);
  if (correlationId) query = query.eq('correlation_id', correlationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: { code: 'READ_FAILED', message: error.message } }, { status: 500 });

  const rows = data || [];
  if (action === 'recent') {
    const recentRows = rows.slice(0, 120);
    const insights = analyzeEvents(recentRows);
    const operational = buildOperationalBacklog(insights);
    return NextResponse.json({
      success: true,
      data: {
        recent: recentRows,
        insights,
        issues: operational.issues,
        tasks: operational.tasks,
        recommendations: operational.recommendations,
      },
    });
  }

  const byCode = (code: string) => rows.filter((x: any) => x.problem_code === code).length;
  const moduleHealth = Object.values(rows.reduce((acc: Record<string, { module: string; total: number; errors: number }>, row: any) => {
    const key = row.module || 'unknown';
    if (!acc[key]) acc[key] = { module: key, total: 0, errors: 0 };
    acc[key].total += 1;
    if (String(row.event).toLowerCase() === 'error') acc[key].errors += 1;
    return acc;
  }, {})).map((item) => ({
    ...item,
    healthScore: Math.max(0, 100 - Math.round((item.errors / Math.max(item.total, 1)) * 100)),
  }));
  const scoreByModule = moduleHealth.reduce((acc: Record<string, number>, item: any) => {
    acc[item.module] = Number(item.healthScore || 0);
    return acc;
  }, {});

  const insights = analyzeEvents(rows);
  const operational = buildOperationalBacklog(insights);

  return NextResponse.json({
    success: true,
    data: {
      totalCriticalEvents: rows.filter((x: any) => ['HIGH', 'CRITICAL'].includes(String(x.severity || '').toUpperCase())).length,
      dietFailures: byCode('diet_pipeline_failed') + byCode('diet_contract_normalization_failed'),
      exerciseFailures: byCode('exercise_detail_low_value_detected'),
      invalidContracts: byCode('invalid_api_contract'),
      monetizationFriction: byCode('premium_cta_friction'),
      onboardingDropoff: byCode('onboarding_dropoff'),
      healthByModule: moduleHealth,
      dietHealthScore: scoreByModule.diet ?? 100,
      exerciseHealthScore: scoreByModule.exercise ?? 100,
      trainingHealthScore: scoreByModule.training ?? 100,
      monetizationHealthScore: scoreByModule.monetization ?? 100,
      insights,
      issues: operational.issues,
      generatedTasks: operational.tasks,
      generatedRecommendations: operational.recommendations,
      recentEvents: rows.slice(0, 80),
      recommendations: rows.map((x: any) => x.recommendation).filter(Boolean).slice(0, 30),
      tasks: rows.map((x: any) => x.task).filter(Boolean).slice(0, 30),
    },
  });
}
