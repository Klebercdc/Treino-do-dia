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
    const isMissingOptionalTable = (error: { code?: string | null; message?: string | null } | null | undefined, table: string) => (
      error?.code === 'PGRST205'
      && new RegExp(`table ['"]?public\\.${table}['"]?`, 'i').test(String(error.message || ''))
    );

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

    const missingExtractions = isMissingOptionalTable(extractions.error, 'lab_report_extractions');
    const missingBiomarkers = isMissingOptionalTable(biomarkers.error, 'lab_report_biomarkers');
    if (extractions.error && !missingExtractions) return NextResponse.json({ ok: false, error: 'Erro ao consultar extrações.' }, { status: 500 });
    if (biomarkers.error && !missingBiomarkers) return NextResponse.json({ ok: false, error: 'Erro ao consultar biomarcadores.' }, { status: 500 });

    const normalizedPayload = report.normalized_payload && typeof report.normalized_payload === 'object'
      ? report.normalized_payload as { extraction?: Record<string, unknown>; biomarkers?: Array<Record<string, unknown>> }
      : {};
    const fallbackExtractions = normalizedPayload.extraction
      ? [{
          id: 'lab-report-inline-extraction',
          lab_report_id: id,
          ...normalizedPayload.extraction,
          created_at: report.processed_at || report.created_at || null,
        }]
      : [];
    const fallbackBiomarkers = Array.isArray(normalizedPayload.biomarkers) ? normalizedPayload.biomarkers : [];

    return NextResponse.json({
      ok: true,
      report,
      extractions: extractions.data || fallbackExtractions,
      biomarkers: biomarkers.data || fallbackBiomarkers,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
