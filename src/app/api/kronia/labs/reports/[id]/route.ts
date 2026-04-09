// NOTE: rota de referência para App Router. Produção Vercel atual usa /api/system (__route=kronia-labs-*) via vercel.json.
import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../../lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function getLabReportByIdForUser(
  admin: SupabaseClient,
  input: { reportId: string; userId: string },
) {
  return admin
    .from('lab_reports')
    .select('*')
    .eq('id', input.reportId)
    .eq('user_id', input.userId)
    .maybeSingle();
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const admin = createAdminSupabaseClient();

    const { data: report, error } = await getLabReportByIdForUser(admin, {
      reportId: id,
      userId: auth.user.id,
    });

    if (error) return NextResponse.json({ ok: false, error: 'Erro ao consultar exame.' }, { status: 500 });
    if (!report) return NextResponse.json({ ok: false, error: 'Exame não encontrado.' }, { status: 404 });

    const [extractions, biomarkers] = await Promise.all([
      admin.from('lab_report_extractions').select('*').eq('lab_report_id', id).order('created_at', { ascending: false }),
      admin.from('lab_report_biomarkers').select('*').eq('lab_report_id', id).order('created_at', { ascending: true }),
    ]);

    if (extractions.error) return NextResponse.json({ ok: false, error: 'Erro ao consultar extrações.' }, { status: 500 });
    if (biomarkers.error) return NextResponse.json({ ok: false, error: 'Erro ao consultar biomarcadores.' }, { status: 500 });

    return NextResponse.json({
      ok: true,
      report,
      extractions: extractions.data || [],
      biomarkers: biomarkers.data || [],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
