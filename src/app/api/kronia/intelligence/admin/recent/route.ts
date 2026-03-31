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

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity');
  const module = searchParams.get('module');
  const correlationId = searchParams.get('correlationId');

  const db = createAdminSupabaseClient();
  let query = db.from('ai_diagnostics').select('*').order('created_at', { ascending: false }).limit(120);
  if (severity) query = query.eq('severity', severity.toUpperCase());
  if (module) query = query.eq('module', module);
  if (correlationId) query = query.eq('correlation_id', correlationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: { code: 'READ_FAILED', message: error.message } }, { status: 500 });

  return NextResponse.json({ success: true, data: { recent: data || [] } });
}
