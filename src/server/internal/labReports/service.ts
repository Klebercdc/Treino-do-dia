import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../../lib/utils/logger';
import type { BiomarkerEntry } from '../../../core/labs/labTypes';
import { buildHealthPerformanceProfile, applyClinicalRulesFromBiomarkers } from '../../../core/labs/labRules';

const DEFAULT_ENGINE = 'exam_ocr_python';
const REVIEW_CONFIDENCE_THRESHOLD = 0.6;
const PROCESSING_STALE_MINUTES = 20;
const UPLOADED_RECOVERY_MINUTES = 3;

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

type OptionalTableName = 'lab_report_extractions' | 'lab_report_biomarkers';
type LabReportMutableFields = Record<string, unknown>;

function isMissingOptionalTable(error: unknown, table: OptionalTableName): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';
  return (code === 'PGRST205' || code === '42P01' || !code)
    && new RegExp(`(?:table|relation) ['"]?public\\.${table}['"]?(?: in the schema cache)? (?:does not exist|was not found)|could not find the table ['"]?public\\.${table}['"]?`, 'i').test(message);
}

function isParseStatusConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';
  return code === '23514' && /lab_reports_parse_status_check/i.test(message);
}

async function updateLabReportWithParseStatusFallback(
  admin: SupabaseClient,
  labReportId: string,
  values: LabReportMutableFields,
  failureLabel: string,
): Promise<void> {
  const first = await admin
    .from('lab_reports')
    .update(values)
    .eq('id', labReportId);

  if (!isParseStatusConstraintViolation(first.error)) {
    if (first.error) throw new Error(`${failureLabel}: ${first.error.message}`);
    return;
  }

  const fallbackValues = { ...values };
  delete fallbackValues.parse_status;

  const fallback = await admin
    .from('lab_reports')
    .update(fallbackValues)
    .eq('id', labReportId);

  if (fallback.error) throw new Error(`${failureLabel}: ${fallback.error.message}`);
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

function resolveExamOcrBaseUrl(): string {
  const explicit = String(process.env.EXAM_OCR_SERVICE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://kronia.app.br').trim();
  return `${appUrl.replace(/\/$/, '')}/api/exam_ocr`;
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
      parse_status: 'uploaded',
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
    .update({ status: 'processing', parse_status: 'processing', processing_error: null })
    .eq('id', labReportId);
  if (error) throw new Error(`Falha ao enfileirar processamento: ${error.message}`);
}

function getProcessingStaleBeforeIso(now = new Date()): string {
  const staleMs = PROCESSING_STALE_MINUTES * 60 * 1000;
  return new Date(now.getTime() - staleMs).toISOString();
}

function getUploadedRecoveryBeforeIso(now = new Date()): string {
  const staleMs = UPLOADED_RECOVERY_MINUTES * 60 * 1000;
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
      parse_status: 'processing',
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

export async function listRecoverableLabReports(
  admin: SupabaseClient,
  limit = 10,
): Promise<Array<{ id: string; storage_bucket: string | null; storage_path: string | null; mime_type: string | null; file_type: string | null; status: string | null; updated_at: string | null }>> {
  const processingStaleBefore = getProcessingStaleBeforeIso();
  const uploadedRecoveryBefore = getUploadedRecoveryBeforeIso();
  const cappedLimit = Math.min(Math.max(limit, 1), 50);
  const baseQuery = 'id,storage_bucket,storage_path,mime_type,file_type,status,updated_at';
  const [uploadedResult, processingResult] = await Promise.all([
    admin
      .from('lab_reports')
      .select(baseQuery)
      .eq('status', 'uploaded')
      .lt('updated_at', uploadedRecoveryBefore)
      .order('updated_at', { ascending: true })
      .limit(cappedLimit),
    admin
      .from('lab_reports')
      .select(baseQuery)
      .eq('status', 'processing')
      .lt('updated_at', processingStaleBefore)
      .order('updated_at', { ascending: true })
      .limit(cappedLimit),
  ]);

  if (uploadedResult.error) throw new Error(`Falha ao listar exames uploaded para recuperação: ${uploadedResult.error.message}`);
  if (processingResult.error) throw new Error(`Falha ao listar exames presos em processing: ${processingResult.error.message}`);

  const merged = [...(uploadedResult.data || []), ...(processingResult.data || [])]
    .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
    .slice(0, cappedLimit);

  return merged as Array<{ id: string; storage_bucket: string | null; storage_path: string | null; mime_type: string | null; file_type: string | null; status: string | null; updated_at: string | null }>;
}

export async function dispatchLabReportToEdgeBestEffort(
  admin: SupabaseClient,
  input: { labReportId: string; source: string; expectedUpdatedAt?: string | null },
): Promise<void> {
  const { error } = await admin.rpc('dispatch_lab_report_to_edge', {
    p_lab_report_id: input.labReportId,
    p_source: input.source,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
  });

  if (!error) return;

  logger.warn('labs_dispatch_rpc_failed', {
    labReportId: input.labReportId,
    source: input.source,
    code: error.code,
    message: error.message,
  });
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
  const url = resolveExamOcrBaseUrl();

  const timeoutMs = Number(process.env.EXAM_OCR_TIMEOUT_MS || 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.replace(/\/$/, ''), {
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
  if (error && !isMissingOptionalTable(error, 'lab_report_extractions')) {
    throw new Error(`Falha ao persistir extração: ${error.message}`);
  }
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

  // Deduplicate by the unique index key: (marker_key, marker_name, coalesce(unit, '')).
  // OCR can return the same marker twice (e.g. two reference ranges). Keep the entry with
  // the higher confidence score; fall back to last-seen when confidence is unavailable.
  const seen = new Map<string, typeof cleaned[number]>();
  for (const row of cleaned) {
    const dedupeKey = `${row.marker_key}\0${row.marker_name}\0${row.unit ?? ''}`;
    const existing = seen.get(dedupeKey);
    if (!existing) {
      seen.set(dedupeKey, row);
    } else {
      const newConf = row.confidence ?? -1;
      const oldConf = existing.confidence ?? -1;
      if (newConf >= oldConf) seen.set(dedupeKey, row);
    }
  }
  const deduped = Array.from(seen.values());

  // If the auxiliary table is not deployed, the canonical fallback becomes
  // lab_reports.normalized_payload and history endpoints read from there.
  const deleteResult = await admin.from('lab_report_biomarkers').delete().eq('lab_report_id', input.labReportId);
  if (deleteResult.error && !isMissingOptionalTable(deleteResult.error, 'lab_report_biomarkers')) {
    throw new Error(`Falha ao limpar biomarcadores: ${deleteResult.error.message}`);
  }

  if (deduped.length) {
    const { error } = await admin.from('lab_report_biomarkers').insert(deduped);
    if (error && !isMissingOptionalTable(error, 'lab_report_biomarkers')) {
      throw new Error(`Falha ao persistir biomarcadores: ${error.message}`);
    }
  }

  return deduped;
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

/**
 * Cast raw biomarker records to typed BiomarkerEntry array.
 * Tolerant of missing fields — unknown fields are coerced/defaulted.
 */
function toBiomarkerEntries(biomarkers: Array<Record<string, unknown>>): BiomarkerEntry[] {
  return biomarkers.map((b) => ({
    marker_key: String(b.marker_key || '').toLowerCase(),
    marker_name: String(b.marker_name || b.marker_key || 'Marcador'),
    value_numeric: toNumber(b.value_numeric),
    value_text: b.value_text != null ? String(b.value_text) : null,
    unit: b.unit != null ? String(b.unit) : null,
    reference_min: toNumber(b.reference_min),
    reference_max: toNumber(b.reference_max),
    reference_text: b.reference_text != null ? String(b.reference_text) : null,
    flag: b.flag != null ? String(b.flag) as BiomarkerEntry['flag'] : null,
    source_line: b.source_line != null ? String(b.source_line) : null,
    confidence: toNumber(b.confidence),
  })).filter((b) => b.marker_key);
}

export async function generateExamInsights(input: {
  biomarkers: Array<Record<string, unknown>>;
  confidenceSummary?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const typedBiomarkers = toBiomarkerEntries(input.biomarkers);
  const profile = buildHealthPerformanceProfile(typedBiomarkers);
  const clinical = applyClinicalRulesFromBiomarkers(typedBiomarkers);

  // Build actionable training adjustments from profile
  const trainingAdjustments: string[] = [];
  if (profile.training_readiness.level === 'critical') {
    trainingAdjustments.push('Sinais críticos detectados: reduzir volume e intensidade imediatamente; avaliação médica recomendada.')
  } else if (profile.training_readiness.level === 'caution') {
    trainingAdjustments.push('Sinais de cautela: modular volume; evitar falha muscular; priorizar recuperação ativa.')
  } else if (profile.training_readiness.level === 'attention') {
    trainingAdjustments.push('Monitorar fadiga e recuperação; ajuste conservador de progressão de carga.')
  } else {
    trainingAdjustments.push('Sem limitações clínicas identificadas. Progressão normal conforme periodização planejada.')
  }

  if (profile.hematologic_status.flags.some((f) => f.includes('hemoglobin') || f.includes('ferritin_low'))) {
    trainingAdjustments.push('Capacidade aeróbica potencialmente reduzida: priorizar treinos de resistência moderados; limitar intensidade máxima.')
  }

  if (profile.androgen_status.flags.some((f) => f.includes('cortisol_high'))) {
    trainingAdjustments.push('Cortisol elevado: incluir deload; priorizar sono 8h+ e técnicas de controle de estresse.')
  }

  if (profile.androgen_status.flags.some((f) => f.includes('testosterone_very_low'))) {
    trainingAdjustments.push('Testosterona muito baixa: volume de treino moderado; frequência de deload aumentada.')
  }

  if (profile.liver_health.level !== 'ok') {
    trainingAdjustments.push('Função hepática alterada: evitar esforço de alta intensidade por tempo prolongado; hidratação rigorosa.')
  }

  if (profile.kidney_hydration.level === 'caution' || profile.kidney_hydration.level === 'critical') {
    trainingAdjustments.push('Função renal comprometida: hidratação obrigatória; evitar suplementos nefrotóxicos; monitorar proteína.')
  }

  // Nutrition adjustments
  const nutritionAdjustments: string[] = []
  for (const note of profile.dietary_attention_points.notes.slice(0, 5)) {
    nutritionAdjustments.push(note)
  }
  if (nutritionAdjustments.length === 0) {
    nutritionAdjustments.push('Distribuição equilibrada de macronutrientes conforme objetivo e composição corporal.')
  }

  // Supplementation notes (conservative)
  const supplementationNotes: string[] = []
  if (profile.micronutrient_status.flags.some((f) => f.includes('vitamin_d_deficient'))) {
    supplementationNotes.push('Vitamina D deficiente: considerar suplementação 1000–4000 UI/dia conforme avaliação médica.')
  }
  if (profile.hematologic_status.flags.some((f) => f.includes('ferritin_very_low') || f.includes('ferritin_low'))) {
    supplementationNotes.push('Ferritina baixa: hierarquizar ferro alimentar (heme); suplementação só após avaliação laboratorial.')
  }
  if (profile.micronutrient_status.flags.some((f) => f.includes('b12_low'))) {
    supplementationNotes.push('B12 baixa: suplementar após avaliação; dose conservadora 500–1000 mcg/dia em deficiências leves.')
  }
  if (supplementationNotes.length === 0) {
    supplementationNotes.push('Manter stack base: proteína, creatina e ômega-3 quando compatíveis com objetivos e perfil clínico.')
  }

  // Recovery signals
  const recoverySignals: string[] = []
  for (const note of profile.recovery_risk.notes.slice(0, 4)) {
    recoverySignals.push(note)
  }
  if (recoverySignals.length === 0) {
    recoverySignals.push('Marcadores de recuperação dentro dos limites esperados.')
  }

  // Safety notes
  const safetyNotes: string[] = ['Sem diagnóstico médico. Análise orientada a treino e produto. Alterações relevantes devem ser avaliadas por médico.']
  for (const note of profile.safety_flags.notes.slice(0, 3)) {
    safetyNotes.push(note)
  }

  return {
    scores: profile.scores,
    health_profile: {
      metabolic_health: profile.metabolic_health,
      lipid_health: profile.lipid_health,
      liver_health: profile.liver_health,
      kidney_hydration: profile.kidney_hydration,
      hematologic_status: profile.hematologic_status,
      thyroid_status: profile.thyroid_status,
      androgen_status: profile.androgen_status,
      inflammation_status: profile.inflammation_status,
      micronutrient_status: profile.micronutrient_status,
      training_readiness: profile.training_readiness,
      recovery_risk: profile.recovery_risk,
      dietary_attention_points: profile.dietary_attention_points,
      safety_flags: profile.safety_flags,
    },
    clinical_flags: clinical.clinicalFlags,
    critical_flags: clinical.criticalFlags,
    clinical_mode: clinical.mode,
    impact_on_training: trainingAdjustments,
    impact_on_nutrition: nutritionAdjustments,
    impact_on_supplementation: supplementationNotes,
    recovery_signals: recoverySignals,
    safety_notes: safetyNotes,
    recommended_follow_up: ['Repetir exame no intervalo recomendado pelo profissional de saúde.'],
    generation_mode: 'rule_based_health_profile',
    provider: 'local',
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
    await updateLabReportWithParseStatusFallback(
      admin,
      input.labReportId,
      {
        status: 'needs_review',
        parse_status: 'processed',
        processing_error: readiness.reason || 'needs_review',
        processed_at: new Date().toISOString(),
        is_valid: false,
      },
      'Falha ao salvar needs_review',
    );
    return { status: 'needs_review', aiInsights: null };
  }

  const aiInsights = await generateExamInsights({
    biomarkers: input.biomarkers,
    confidenceSummary: input.confidenceSummary,
  });

  await updateLabReportWithParseStatusFallback(
    admin,
    input.labReportId,
    {
      status: 'analyzed',
      parse_status: 'processed',
      ai_insights: aiInsights,
      processed_at: new Date().toISOString(),
      is_valid: true,
    },
    'Falha ao salvar análise do exame',
  );

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

  await updateLabReportWithParseStatusFallback(
    admin,
    input.labReportId,
    {
      status: 'extracted',
      parse_status: 'processed',
      extraction_mode: ocr.extraction_mode,
      source_type: ocr.source_type,
      normalized_payload: {
        biomarkers: normalizedBiomarkers,
        extraction: {
          engine: DEFAULT_ENGINE,
          extraction_mode: ocr.extraction_mode,
          raw_text: ocr.raw_text || null,
          pages: ocr.pages || [],
          blocks: ocr.blocks || [],
          rows: ocr.rows || [],
          warnings: ocr.warnings || [],
          metadata: ocr.metadata || {},
          confidence_summary: ocr.confidence_summary || {},
        },
      },
      confidence_summary: ocr.confidence_summary || {},
      processing_error: null,
    },
    'Falha ao atualizar lab_report após OCR',
  );

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
