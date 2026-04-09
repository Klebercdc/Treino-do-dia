import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../../lib/utils/logger';

const DEFAULT_ENGINE = 'exam_ocr_python';
const REVIEW_CONFIDENCE_THRESHOLD = 0.6;
const PROCESSING_STALE_MINUTES = 20;

export type LabReportStatus = 'pending_upload' | 'uploaded' | 'processing' | 'extracted' | 'needs_review' | 'analyzed' | 'failed';

export interface ExamOcrResponse {
  success: boolean;
  source_type: 'pdf' | 'image' | 'unknown';
  extraction_mode: 'native_pdf' | 'ocr' | 'failed';
  raw_text: string;
  pages: unknown[];
  blocks: unknown[];
  rows: unknown[];
  biomarkers_detected: Array<Record<string, unknown>>;
  confidence_summary: Record<string, unknown>;
  warnings: string[];
  metadata: Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeFlag(value: number | null, min: number | null, max: number | null): string | null {
  if (value === null) return null;
  if (min !== null && value < min) return 'low';
  if (max !== null && value > max) return 'high';
  return 'normal';
}

export async function createLabReportRecord(
  admin: SupabaseClient,
  input: {
    userId: string;
    storageBucket: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from('lab_reports')
    .insert({
      user_id: input.userId,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      file_url: input.storagePath,
      file_name: input.fileName,
      file_type: input.mimeType,
      mime_type: input.mimeType,
      status: 'uploaded',
      parse_status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data?.id) throw new Error(`Falha ao criar lab_report: ${error?.message || 'unknown'}`);
  return { id: String(data.id) };
}

export async function deleteLabReportRecord(
  admin: SupabaseClient,
  labReportId: string,
): Promise<void> {
  const { error } = await admin.from('lab_reports').delete().eq('id', labReportId);
  if (error) throw new Error(`Falha ao remover lab_report após erro: ${error.message}`);
}

export async function enqueueLabReportProcessing(
  admin: SupabaseClient,
  labReportId: string,
): Promise<void> {
  const { error } = await admin
    .from('lab_reports')
    .update({ status: 'processing', parse_status: 'pending', processing_error: null })
    .eq('id', labReportId);
  if (error) throw new Error(`Falha ao enfileirar processamento: ${error.message}`);
}

function getProcessingStaleBeforeIso(now = new Date()): string {
  const staleMs = PROCESSING_STALE_MINUTES * 60 * 1000;
  return new Date(now.getTime() - staleMs).toISOString();
}

function canAcquireProcessingLock(status: string | null | undefined, updatedAt: string | null | undefined): boolean {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'uploaded' || normalized === 'failed' || normalized === 'needs_review') {
    return true;
  }

  if (normalized !== 'processing') return false;
  if (!updatedAt) return true;

  const staleBefore = Date.parse(getProcessingStaleBeforeIso());
  const updatedAtMs = Date.parse(String(updatedAt));
  if (!Number.isFinite(updatedAtMs)) return true;
  return updatedAtMs <= staleBefore;
}

export async function acquireLabReportProcessingLock(
  admin: SupabaseClient,
  input: {
    labReportId: string;
    currentStatus: string;
    updatedAt?: string | null;
  },
): Promise<boolean> {
  if (!canAcquireProcessingLock(input.currentStatus, input.updatedAt)) return false;

  let query = admin
    .from('lab_reports')
    .update({
      status: 'processing',
      parse_status: 'pending',
      processing_error: null,
    })
    .eq('id', input.labReportId)
    .eq('status', input.currentStatus);

  if (input.updatedAt) {
    query = query.eq('updated_at', input.updatedAt);
  }

  const { data, error } = await query.select('id').limit(1);

  if (error) throw new Error(`Falha ao adquirir lock de processamento: ${error.message}`);
  return Array.isArray(data) && data.length === 1;
}

export async function listStaleProcessingLabReports(
  admin: SupabaseClient,
  limit = 10,
): Promise<Array<{ id: string; storage_bucket: string | null; storage_path: string | null; mime_type: string | null; file_type: string | null; status: string | null; updated_at: string | null }>> {
  const staleBefore = getProcessingStaleBeforeIso();
  const { data, error } = await admin
    .from('lab_reports')
    .select('id,storage_bucket,storage_path,mime_type,file_type,status,updated_at')
    .eq('status', 'processing')
    .lt('updated_at', staleBefore)
    .order('updated_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) throw new Error(`Falha ao listar exames presos em processing: ${error.message}`);
  return (data || []) as Array<{ id: string; storage_bucket: string | null; storage_path: string | null; mime_type: string | null; file_type: string | null; status: string | null; updated_at: string | null }>;
}

export async function downloadLabReportFromStorage(
  admin: SupabaseClient,
  input: { storageBucket: string; storagePath: string },
): Promise<{ signedUrl: string }> {
  const { data, error } = await admin.storage.from(input.storageBucket).createSignedUrl(input.storagePath, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(`Falha ao gerar signed URL: ${error?.message || 'unknown'}`);
  return { signedUrl: data.signedUrl };
}

export async function invokeExamOcrService(input: {
  sourceId: string;
  mimeType: string;
  fileUrl: string;
  language?: string;
  preferNativePdf?: boolean;
}): Promise<ExamOcrResponse> {
  const url = process.env.EXAM_OCR_SERVICE_URL;
  if (!url) throw new Error('EXAM_OCR_SERVICE_URL não configurada.');

  const timeoutMs = Number(process.env.EXAM_OCR_TIMEOUT_MS || 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: input.sourceId,
        mime_type: input.mimeType,
        file_url: input.fileUrl,
        language: input.language || 'por+eng',
        prefer_native_pdf: input.preferNativePdf !== false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OCR service ${res.status}: ${body.slice(0, 200)}`);
    }
    const payload = (await res.json()) as ExamOcrResponse;
    if (payload?.success !== true) {
      throw new Error('OCR service retornou success=false');
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function markLabReportAsFailed(
  admin: SupabaseClient,
  input: { labReportId: string; reason: string },
): Promise<void> {
  await admin
    .from('lab_reports')
    .update({
      status: 'failed',
      parse_status: 'failed',
      processing_error: input.reason.slice(0, 280),
      processed_at: new Date().toISOString(),
      is_valid: false,
    })
    .eq('id', input.labReportId);
}

export async function persistLabExtraction(
  admin: SupabaseClient,
  input: {
    labReportId: string;
    ocr: ExamOcrResponse;
  },
): Promise<void> {
  const ocr = input.ocr;
  const { error } = await admin.from('lab_report_extractions').insert({
    lab_report_id: input.labReportId,
    engine: DEFAULT_ENGINE,
    extraction_mode: ocr.extraction_mode,
    raw_text: ocr.raw_text || null,
    pages: ocr.pages || [],
    blocks: ocr.blocks || [],
    rows: ocr.rows || [],
    warnings: ocr.warnings || [],
    metadata: ocr.metadata || {},
    confidence_summary: ocr.confidence_summary || {},
  });
  if (error) throw new Error(`Falha ao persistir extração: ${error.message}`);
}

export async function persistBiomarkers(
  admin: SupabaseClient,
  input: {
    labReportId: string;
    biomarkers: Array<Record<string, unknown>>;
  },
): Promise<Array<Record<string, unknown>>> {
  const cleaned = (input.biomarkers || []).map((item) => {
    const markerKey = String(item.marker_key || item.marker || item.name || '').trim().toLowerCase();
    const markerName = String(item.marker_name || item.name || markerKey || 'Marcador');
    const valueNumeric = toNumber(item.value_numeric ?? item.value);
    const referenceMin = toNumber(item.reference_min);
    const referenceMax = toNumber(item.reference_max);
    return {
      lab_report_id: input.labReportId,
      marker_key: markerKey,
      marker_name: markerName,
      value_numeric: valueNumeric,
      value_text: item.value_text != null ? String(item.value_text) : null,
      unit: item.unit != null ? String(item.unit) : null,
      reference_min: referenceMin,
      reference_max: referenceMax,
      reference_text: item.reference_text != null ? String(item.reference_text) : null,
      flag: item.flag != null ? String(item.flag) : normalizeFlag(valueNumeric, referenceMin, referenceMax),
      source_line: item.source_line != null ? String(item.source_line) : null,
      confidence: toNumber(item.confidence),
    };
  }).filter((row) => row.marker_key);

  await admin.from('lab_report_biomarkers').delete().eq('lab_report_id', input.labReportId);

  if (cleaned.length) {
    const { error } = await admin.from('lab_report_biomarkers').insert(cleaned);
    if (error) throw new Error(`Falha ao persistir biomarcadores: ${error.message}`);
  }

  return cleaned;
}

export function computeReadinessForAI(input: {
  confidenceSummary?: Record<string, unknown>;
  biomarkers: Array<Record<string, unknown>>;
  warnings?: string[];
}): { ready: boolean; needsReview: boolean; reason?: string } {
  const mean = toNumber(input.confidenceSummary?.mean_confidence ?? input.confidenceSummary?.overall_confidence) ?? 0;
  const hasData = input.biomarkers.length > 0;
  const hasHardWarning = (input.warnings || []).some((w) => /low_confidence|ocr_failed|no_text/i.test(String(w)));

  if (!hasData) return { ready: false, needsReview: true, reason: 'no_biomarkers' };
  if (hasHardWarning || mean < REVIEW_CONFIDENCE_THRESHOLD) {
    return { ready: false, needsReview: true, reason: 'low_confidence' };
  }
  return { ready: true, needsReview: false };
}

function buildRuleBasedScores(biomarkers: Array<Record<string, unknown>>) {
  const byKey = new Map<string, number>();
  for (const b of biomarkers) {
    const key = String(b.marker_key || '').toLowerCase();
    const value = toNumber(b.value_numeric);
    if (key && value !== null) byKey.set(key, value);
  }

  const glucose = byKey.get('glucose');
  const hba1c = byKey.get('hba1c');
  const ldl = byKey.get('ldl');
  const creatinine = byKey.get('creatinine');

  const metabolic = glucose && glucose > 110 ? 45 : 78;
  const hormonal = 70;
  const hematologic = 72;
  const recovery = hba1c && hba1c > 5.7 ? 55 : 80;
  const safety = (ldl && ldl > 160) || (creatinine && creatinine > 1.5) ? 42 : 82;

  return {
    recovery_score: recovery,
    metabolic_score: metabolic,
    hematologic_score: hematologic,
    hormonal_score: hormonal,
    safety_score: safety,
  };
}

export async function generateExamInsights(input: {
  biomarkers: Array<Record<string, unknown>>;
  confidenceSummary?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const scores = buildRuleBasedScores(input.biomarkers);
  return {
    ...scores,
    impact_on_training: [
      'Modular volume e intensidade com base no recovery_score e safety_score.',
      'Se safety_score baixo, priorizar técnica, sono e reduzir proximidade da falha.',
    ],
    impact_on_nutrition: [
      'Ajustar distribuição de carboidratos conforme metabolic_score.',
      'Priorizar proteína adequada e densidade nutricional para suporte de recuperação.',
    ],
    impact_on_supplementation: [
      'Manter stack base conservador (creatina, proteína, ômega-3 quando aplicável).',
      'Evitar recomendações agressivas sem marcador específico confiável.',
    ],
    recovery_signals: [
      'Combinar biomarcadores com sono, fadiga subjetiva e carga interna.',
    ],
    safety_notes: [
      'Sem diagnóstico médico. Em alterações relevantes, orientar avaliação profissional.',
    ],
    recommended_follow_up: [
      'Repetir exame no intervalo definido pelo profissional de saúde.',
    ],
  };
}

export async function getUserLabReportTimeline(
  admin: SupabaseClient,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .from('lab_reports')
    .select('id,file_name,status,processed_at,created_at,confidence_summary,ai_insights')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`Falha ao carregar timeline: ${error.message}`);
  return (data || []) as Array<Record<string, unknown>>;
}

export async function analyzeLabReportForUserContext(
  admin: SupabaseClient,
  input: { labReportId: string; biomarkers: Array<Record<string, unknown>>; confidenceSummary?: Record<string, unknown> },
): Promise<{ status: LabReportStatus; aiInsights: Record<string, unknown> | null }> {
  const readiness = computeReadinessForAI({
    biomarkers: input.biomarkers,
    confidenceSummary: input.confidenceSummary,
  });

  if (!readiness.ready) {
    await admin
      .from('lab_reports')
      .update({
        status: 'needs_review',
        parse_status: 'failed',
        processing_error: readiness.reason || 'needs_review',
        processed_at: new Date().toISOString(),
      })
      .eq('id', input.labReportId);
    return { status: 'needs_review', aiInsights: null };
  }

  const aiInsights = await generateExamInsights({
    biomarkers: input.biomarkers,
    confidenceSummary: input.confidenceSummary,
  });

  await admin
    .from('lab_reports')
    .update({
      status: 'analyzed',
      parse_status: 'parsed',
      ai_insights: aiInsights,
      processed_at: new Date().toISOString(),
      is_valid: true,
    })
    .eq('id', input.labReportId);

  return { status: 'analyzed', aiInsights };
}

export async function processLabReportUpload(
  admin: SupabaseClient,
  input: {
    labReportId: string;
    storageBucket: string;
    storagePath: string;
    mimeType: string;
  },
): Promise<{ status: LabReportStatus; biomarkersCount: number }> {
  const startedAt = Date.now();
  logger.info('labs_pipeline_started', { labReportId: input.labReportId, mimeType: input.mimeType });

  const { signedUrl } = await downloadLabReportFromStorage(admin, {
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  });

  const ocr = await invokeExamOcrService({
    sourceId: input.labReportId,
    mimeType: input.mimeType,
    fileUrl: signedUrl,
  });

  await persistLabExtraction(admin, { labReportId: input.labReportId, ocr });
  const normalizedBiomarkers = await persistBiomarkers(admin, {
    labReportId: input.labReportId,
    biomarkers: ocr.biomarkers_detected || [],
  });

  await admin
    .from('lab_reports')
    .update({
      status: 'extracted',
      parse_status: 'parsed',
      extraction_mode: ocr.extraction_mode,
      source_type: ocr.source_type,
      normalized_payload: { biomarkers: normalizedBiomarkers },
      confidence_summary: ocr.confidence_summary || {},
      processing_error: null,
    })
    .eq('id', input.labReportId);

  const analysis = await analyzeLabReportForUserContext(admin, {
    labReportId: input.labReportId,
    biomarkers: normalizedBiomarkers,
    confidenceSummary: ocr.confidence_summary || {},
  });

  logger.info('labs_pipeline_finished', {
    labReportId: input.labReportId,
    status: analysis.status,
    extractionMode: ocr.extraction_mode,
    sourceType: ocr.source_type,
    biomarkersCount: normalizedBiomarkers.length,
    durationMs: Date.now() - startedAt,
  });

  return { status: analysis.status, biomarkersCount: normalizedBiomarkers.length };
}

export async function processLabReportUploadSafely(
  admin: SupabaseClient,
  input: {
    labReportId: string;
    storageBucket: string;
    storagePath: string;
    mimeType: string;
  },
): Promise<{ status: LabReportStatus; biomarkersCount: number }> {
  try {
    return await processLabReportUpload(admin, input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'processing_failed';
    await markLabReportAsFailed(admin, { labReportId: input.labReportId, reason });
    logger.warn('labs_pipeline_failed', {
      labReportId: input.labReportId,
      reason,
    });
    return { status: 'failed', biomarkersCount: 0 };
  }
}
