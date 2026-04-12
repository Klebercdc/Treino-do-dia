// NOTE: rota de referência para App Router. Produção Vercel atual usa /api/system (__route=kronia-labs-*) via vercel.json.
import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../../_shared/requireBearerAuth';
import { createAdminSupabaseClient } from '../../../../../lib/supabase/admin';
import { getUserLabReportTimeline } from '../../../../../server/internal/labReports/service';

export const runtime = 'nodejs';

function isMissingOptionalRelation(
  error: { code?: string | null; message?: string | null } | null | undefined,
  table: string,
) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return (code === 'PGRST205' || code === '42P01' || !code)
    && new RegExp(`(?:table|relation) ['"]?public\\.${table}['"]?(?: in the schema cache)? (?:does not exist|was not found)|could not find the table ['"]?public\\.${table}['"]?`, 'i').test(message);
}

function extractBiomarkersFromPayload(row: Record<string, unknown>) {
  const payload = row.normalized_payload;
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { biomarkers?: unknown[] }).biomarkers)) {
    return [];
  }
  return (payload as { biomarkers: Array<Record<string, unknown>> }).biomarkers;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response as Response;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || '10'), 50);
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from('lab_reports')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: 'Erro ao buscar histórico de exames.' }, { status: 500 });
    }

    const ids = (data || []).map((row) => row.id).filter(Boolean);
    const biomarkerMap = new Map<string, Array<Record<string, unknown>>>();
    if (ids.length) {
      const { data: biomarkers, error: biomarkersError } = await admin
        .from('lab_report_biomarkers')
        .select('*')
        .in('lab_report_id', ids)
        .order('created_at', { ascending: true });

      if (Array.isArray(biomarkers)) {
        for (const row of biomarkers || []) {
          const key = String(row.lab_report_id);
          if (!biomarkerMap.has(key)) biomarkerMap.set(key, []);
          biomarkerMap.get(key)?.push(row as Record<string, unknown>);
        }
      } else if (isMissingOptionalRelation(biomarkersError, 'lab_report_biomarkers')) {
      } else if (biomarkersError) {
        return NextResponse.json({ ok: false, error: 'Erro ao buscar biomarcadores do histórico.' }, { status: 500 });
      }
    }

    const reports = (data || []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      fileType: row.mime_type || row.file_type,
      status: row.status || row.parse_status,
      parseStatus: row.parse_status,
      extractionMode: row.extraction_mode,
      sourceType: row.source_type,
      confidenceSummary: row.confidence_summary || {},
      normalizedPayload: row.normalized_payload || null,
      aiInsights: row.ai_insights || null,
      canonicalStatus: row.canonical_status || null,
      reviewStatus: row.review_status || null,
      releasedSnapshot: row.released_snapshot || null,
      version: row.version || null,
      isValid: row.is_valid,
      processingError: row.processing_error,
      biomarkers: biomarkerMap.get(String(row.id)) || extractBiomarkersFromPayload(row as Record<string, unknown>),
      clinicalFlags: Array.isArray((row.ai_insights as { clinical_flags?: unknown[] } | null)?.clinical_flags)
        ? ((row.ai_insights as { clinical_flags?: unknown[] }).clinical_flags || []).map((item) => String(item || '')).filter(Boolean)
        : [],
      criticalFlags: Array.isArray((row.ai_insights as { critical_flags?: unknown[] } | null)?.critical_flags)
        ? ((row.ai_insights as { critical_flags?: unknown[] }).critical_flags || []).map((item) => String(item || '')).filter(Boolean)
        : [],
      createdAt: row.created_at,
      processedAt: row.processed_at,
    }));

    const timeline = await getUserLabReportTimeline(admin, auth.user.id);
    return NextResponse.json({ ok: true, reports, timeline, total: reports.length });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error('[labs/reports] erro interno:', reason.slice(0, 300))
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
