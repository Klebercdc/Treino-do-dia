import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../../../../../lib/supabase/admin';
import { createServerSupabaseClient } from '../../../../../../lib/supabase/server';

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
  return isAdminEmail(data.user.email) ? data.user : null;
}

export async function GET(req: Request) {
  const admin = await ensureAdmin(req);
  if (!admin) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const db = createAdminSupabaseClient();
  const { data, error } = await db.from('ai_diagnostics').select('*').order('created_at', { ascending: false }).limit(400);
  if (error) return NextResponse.json({ success: false, error: { code: 'READ_FAILED', message: error.message } }, { status: 500 });

  const rows = data || [];
  const byCode = (code: string) => rows.filter((x: any) => x.problem_code === code).length;
  const criticalEvents = rows.filter((x: any) => ['CRITICAL', 'HIGH'].includes(String(x.severity || '').toUpperCase())).length;

  return NextResponse.json({
    success: true,
    data: {
      totalCriticalEvents: criticalEvents,
      dietFailures: byCode('diet_pipeline_failed') + byCode('diet_contract_normalization_failed'),
      exerciseFailures: byCode('exercise_detail_low_value_detected'),
      invalidContracts: byCode('invalid_api_contract'),
      monetizationFriction: byCode('premium_cta_friction'),
      onboardingDropoff: byCode('onboarding_dropoff'),
      healthByModule: Object.values(rows.reduce((acc: any, row: any) => {
        const key = row.module || 'unknown';
        if (!acc[key]) acc[key] = { module: key, total: 0, errors: 0 };
        acc[key].total += 1;
        if (String(row.event).toLowerCase() === 'error') acc[key].errors += 1;
        return acc;
      }, {})).map((item: any) => ({ ...item, healthScore: Math.max(0, 100 - Math.round((item.errors / Math.max(item.total, 1)) * 100)) })),
      recommendations: rows.map((x: any) => x.recommendation).filter(Boolean).slice(0, 30),
      tasks: rows.map((x: any) => x.task).filter(Boolean).slice(0, 30),
    },
  });
}
