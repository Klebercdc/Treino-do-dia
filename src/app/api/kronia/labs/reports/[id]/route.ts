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

function isDeletionBlockedStatus(statusKey: string): boolean {
  return statusKey === 'pending_upload'
    || statusKey === 'uploaded'
    || statusKey === 'queued'
    || statusKey === 'processing'
    || statusKey === 'extracted';
}

function normalizeStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function isMissingOptionalRelation(
  error: { code?: string | null; message?: string | null } | null | undefined,
  table: string,
): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return (code === 'PGRST205' || code === '42P01' || !code)
    && new RegExp(`(?:table|relation) ['"]?public\\.${table}['"]?(?: in the schema cache)? (?:does not exist|was not found)|could not find the table ['"]?public\\.${table}['"]?`, 'i').test(message);
}

function extractBiomarkersFromPayload(report: Record<string, unknown>): Array<Record<string, unknown>> {
  const normalizedPayload = report.normalized_payload && typeof report.normalized_payload === 'object'
    ? report.normalized_payload as { biomarkers?: Array<Record<string, unknown>> }
    : {};
  return Array.isArray(normalizedPayload.biomarkers) ? normalizedPayload.biomarkers : [];
}

function buildFallbackExtractions(report: Record<string, unknown>, id: string) {
  const normalizedPayload = report.normalized_payload && typeof report.normalized_payload === 'object'
    ? report.normalized_payload as { extraction?: Record<string, unknown> }
    : {};
  return normalizedPayload.extraction
    ? [{
        id: 'lab-report-inline-extraction',
        lab_report_id: id,
        ...normalizedPayload.extraction,
        created_at: report.processed_at || report.created_at || null,
      }]
    : [];
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

    const missingExtractions = isMissingOptionalRelation(extractions.error, 'lab_report_extractions');
    const missingBiomarkers = isMissingOptionalRelation(biomarkers.error, 'lab_report_biomarkers');
    if (extractions.error && !missingExtractions) return NextResponse.json({ ok: false, error: 'Erro ao consultar extrações.' }, { status: 500 });
    if (biomarkers.error && !missingBiomarkers) return NextResponse.json({ ok: false, error: 'Erro ao consultar biomarcadores.' }, { status: 500 });

    const fallbackExtractions = buildFallbackExtractions(report as Record<string, unknown>, id);
    const fallbackBiomarkers = extractBiomarkersFromPayload(report as Record<string, unknown>);
    const reviewStatus = String((report as { review_status?: unknown }).review_status || '');
    const releasedSnapshot = (report as { released_snapshot?: unknown }).released_snapshot || null;
    const safeReport = {
      ...report,
      machine_snapshot: reviewStatus === 'released' ? (report as { machine_snapshot?: unknown }).machine_snapshot || null : null,
      reviewed_snapshot: reviewStatus === 'released' ? (report as { reviewed_snapshot?: unknown }).reviewed_snapshot || null : null,
      released_snapshot: releasedSnapshot,
    };

    return NextResponse.json({
      ok: true,
      report: {
        ...safeReport,
        clinicalFlags: normalizeStringArray((report.ai_insights as { clinical_flags?: unknown[] } | null)?.clinical_flags || report.clinical_flags),
        criticalFlags: normalizeStringArray((report.ai_insights as { critical_flags?: unknown[] } | null)?.critical_flags || report.critical_flags),
      },
      extractions: Array.isArray(extractions.data) && extractions.data.length > 0 ? extractions.data : fallbackExtractions,
      biomarkers: Array.isArray(biomarkers.data) && biomarkers.data.length > 0 ? biomarkers.data : fallbackBiomarkers,
      releasedSnapshot,
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

    const { data: report, error } = await getLabReportByIdForUser(admin, {
      reportId: id,
      userId: auth.user.id,
    });

    if (error) return NextResponse.json({ ok: false, error: 'Erro ao consultar exame.' }, { status: 500 });
    if (!report) return NextResponse.json({ ok: false, error: 'Exame não encontrado.' }, { status: 404 });

    const statusKey = String(report.status || report.parse_status || '').toLowerCase();
    if (isDeletionBlockedStatus(statusKey)) {
      return NextResponse.json({
        ok: false,
        error: 'Este exame ainda está em processamento e não pode ser excluído agora.',
        code: 'REPORT_STILL_PROCESSING',
      }, { status: 409 });
    }

    const deletion = await admin.from('lab_reports').delete().eq('id', id).eq('user_id', auth.user.id);
    if (deletion.error) {
      return NextResponse.json({ ok: false, error: 'Falha ao remover exame.', code: 'DB_DELETE_ERROR' }, { status: 500 });
    }

    const storageBucket = String(report.storage_bucket || 'lab-reports');
    const storagePath = String(report.storage_path || '').trim();
    if (storagePath) {
      const removal = await admin.storage.from(storageBucket).remove([storagePath]);
      if (removal.error) {
        console.warn('[app-router/labs/delete] storage cleanup failed after db delete', {
          reportId: id,
          storageBucket,
          storagePath,
          error: removal.error.message || removal.error,
        });
      }
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ ok: false, error: reason.slice(0, 200) }, { status: 500 });
  }
}
