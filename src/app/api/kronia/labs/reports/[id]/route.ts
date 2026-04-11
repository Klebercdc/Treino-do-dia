// NOTE: rota de referência para App Router. Produção Vercel atual usa /api/system (__route=kronia-labs-*) via vercel.json.
import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../../lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

const LAB_REPORTS_BUCKET = 'lab-reports';

function isMissingOptionalTable(
  error: { code?: string | null; message?: string | null } | null | undefined,
  table: string,
) {
  return (
    error?.code === 'PGRST205' &&
    new RegExp(`table ['"]?public\\.${table}['"]?`, 'i').test(String(error.message || ''))
  );
}

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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const admin = createAdminSupabaseClient();

    const { data: report, error: fetchError } = await admin
      .from('lab_reports')
      .select('id,user_id,status,parse_status,storage_path,storage_bucket')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ ok: false, error: 'Erro ao verificar exame.' }, { status: 500 });
    if (!report) return NextResponse.json({ ok: false, error: 'Exame não encontrado.' }, { status: 404 });

    if (report.status === 'processing' || report.parse_status === 'processing') {
      return NextResponse.json(
        { ok: false, error: 'Exame em processamento. Aguarde a conclusão antes de excluir.', code: 'REPORT_PROCESSING' },
        { status: 409 },
      );
    }

    // Best-effort storage cleanup
    const bucket = String(report.storage_bucket || LAB_REPORTS_BUCKET);
    const storagePath = report.storage_path ? String(report.storage_path) : null;
    if (storagePath) {
      const { error: storageError } = await admin.storage.from(bucket).remove([storagePath]);
      if (storageError) {
        console.warn('[labs/delete] aviso ao remover storage:', { path: storagePath, reason: storageError.message });
      }
    }

    // Delete child records (optional tables — ignore missing table errors)
    const childTables = ['lab_report_pipeline_events', 'lab_report_biomarkers', 'lab_report_extractions'] as const;
    for (const table of childTables) {
      const { error: childError } = await admin.from(table).delete().eq('lab_report_id', id);
      if (childError && !isMissingOptionalTable(childError, table)) {
        console.warn(`[labs/delete] erro ao excluir ${table}:`, childError.message);
      }
    }

    // Delete parent record scoped to owner
    const { error: deleteError } = await admin
      .from('lab_reports')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (deleteError) {
      return NextResponse.json({ ok: false, error: 'Erro ao excluir exame da base de dados.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
