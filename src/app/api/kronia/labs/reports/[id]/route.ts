import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../../lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const admin = createAdminSupabaseClient();

  const { data: report, error } = await admin
    .from('lab_reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: 'Erro ao consultar exame.' }, { status: 500 });
  if (!report) return NextResponse.json({ ok: false, error: 'Exame não encontrado.' }, { status: 404 });

  const [extractions, biomarkers] = await Promise.all([
    admin.from('lab_report_extractions').select('*').eq('lab_report_id', id).order('created_at', { ascending: false }),
    admin.from('lab_report_biomarkers').select('*').eq('lab_report_id', id).order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({
    ok: true,
    report,
    extractions: extractions.data || [],
    biomarkers: biomarkers.data || [],
  });
}
