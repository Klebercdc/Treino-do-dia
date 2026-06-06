// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { BiomarkerEntry } from '../../../src/core/labs/labTypes.ts';
import { buildHealthPerformanceProfile } from '../../../src/core/labs/labHealthProfile.ts';
import {
  enrichBiomarkerEntries,
  extractHormoneContextFromProfileRow,
  summarizeMarkerInterpretations,
} from '../../../src/core/labs/labInterpretation.ts';
import { persistCanonicalMachineResult } from '../../../src/server/internal/labReports/canonical.ts';
import { applyClinicalRulesFromBiomarkers } from '../../../src/core/labs/labRules.ts';
import type { UserProfile } from '../../../src/core/labs/benchmarks.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const EXAM_OCR_SERVICE_URL = Deno.env.get('EXAM_OCR_SERVICE_URL') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kronia.app.br';
const EXAM_OCR_TIMEOUT_MS = Number(Deno.env.get('EXAM_OCR_TIMEOUT_MS') ?? '45000');
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const GROQ_MODEL = Deno.env.get('AI_CHAT_MODEL') ?? 'llama-3.3-70b-versatile';
const LAB_REPORTS_BUCKET = 'lab-reports';
const STALE_MINUTES = 20;
const UPLOADED_RECOVERY_MINUTES = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY obrigatórias para lab-report-orchestrator');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Biomarker = {
  marker_key: string;
  marker_name: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  reference_text: string | null;
  flag: string | null;
  source_line: string | null;
  confidence: number | null;
  reference_text_raw?: string | null;
  normalized_reference?: Record<string, unknown> | null;
  lab_flag?: string | null;
  context_flag?: string | null;
  interpretation_mode?: string | null;
  monitor_priority?: string | null;
  safety_relevance?: boolean | null;
  feedback_summary?: string | null;
  source_reference_kind?: string | null;
};

type OcrResponse = {
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
  exam_date?: string | null;
};

type OptionalTableName = 'lab_report_extractions' | 'lab_report_biomarkers';
type LabReportUpdate = Record<string, unknown>;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFlag(value: number | null, min: number | null, max: number | null): string | null {
  if (value === null) return null;
  if (min !== null && value < min) return 'low';
  if (max !== null && value > max) return 'high';
  return 'normal';
}

function resolveExamOcrBaseUrl() {
  if (EXAM_OCR_SERVICE_URL) return EXAM_OCR_SERVICE_URL.replace(/\/$/, '');
  return `${APP_URL.replace(/\/$/, '')}/api/exam_ocr`;
}

function brDateToIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// Extrai data de coleta do raw_text de forma conservadora.
// Prioriza rótulos inequívocos ("Coleta", "Data da Coleta", "Data do Exame", "Realizado em").
// Retorna null se nenhuma data encontrada ou se houver ambiguidade (datas distintas).
function extractExamDateFromRawText(rawText: string | null | undefined): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  // Matches labels that unambiguously refer to collection/exam date. "Data de nascimento" is
  // deliberately absent — UNIMED layouts place birth date near "Data Entrada" / similar labels.
  const re = /(?:Data\s+d[ae]\s+[Cc]oleta|Data\s+do\s+[Ee]xame|[Rr]ealizado\s+em|[Cc]oleta)[^0-9]{0,50}?(\d{2}\/\d{2}\/\d{4})/gi;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(rawText)) !== null) {
    const iso = brDateToIso(match[1]);
    if (iso) found.add(iso);
  }
  return found.size === 1 ? [...found][0] : null;
}

function isMissingOptionalTable(error: unknown, table: OptionalTableName): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (code === 'PGRST205' || code === '42P01' || !code)
    && new RegExp(`(?:table|relation) ['"]?public\\.${table}['"]?(?: in the schema cache)? (?:does not exist|was not found)|could not find the table ['"]?public\\.${table}['"]?`, 'i').test(message);
}

function resolveExamDate(ocr: OcrResponse): string | null {
  const date = ocr.exam_date || extractExamDateFromRawText(ocr.raw_text);
  const source = ocr.exam_date ? 'ocr' : date ? 'raw_text' : 'none';
  if (source !== 'none') console.log(`[orchestrator] exam_date resolved via ${source}: ${date}`);
  return date || null;
}

function buildNormalizedPayload(ocr: OcrResponse, biomarkers: Biomarker[]) {
  return {
    biomarkers,
    exam_date: resolveExamDate(ocr),
    extraction: {
      engine: 'exam_ocr_python',
      extraction_mode: ocr.extraction_mode,
      raw_text: ocr.raw_text || null,
      pages: ocr.pages || [],
      blocks: ocr.blocks || [],
      rows: ocr.rows || [],
      warnings: ocr.warnings || [],
      metadata: ocr.metadata || {},
      confidence_summary: ocr.confidence_summary || {},
    },
  };
}

function isParseStatusConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return code === '23514' && /lab_reports_parse_status_check/i.test(message);
}

async function updateLabReportWithParseStatusFallback(
  labReportId: string,
  values: LabReportUpdate,
  failureLabel: string,
) {
  const { error } = await supabase
    .from('lab_reports')
    .update(values)
    .eq('id', labReportId);

  if (!isParseStatusConstraintViolation(error)) {
    if (error) throw new Error(`${failureLabel}: ${error.message}`);
    return;
  }

  const fallbackValues = { ...values };
  delete fallbackValues.parse_status;

  const fallback = await supabase
    .from('lab_reports')
    .update(fallbackValues)
    .eq('id', labReportId);

  if (fallback.error) throw new Error(`${failureLabel}: ${fallback.error.message}`);
}

async function logEvent(labReportId: string, eventType: string, level = 'info', details: Record<string, unknown> = {}) {
  await supabase.from('lab_report_pipeline_events').insert({
    lab_report_id: labReportId,
    event_type: eventType,
    level,
    details,
  });
}

async function fetchLabReport(labReportId: string) {
  const { data, error } = await supabase
    .from('lab_reports')
    .select('id,user_id,storage_bucket,storage_path,mime_type,file_type,status,parse_status,updated_at,processing_attempts')
    .eq('id', labReportId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao carregar lab_report: ${error.message}`);
  return data;
}

async function fetchProfileRow(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[lab-report-orchestrator] profile lookup failed', {
      userId,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  return data as Record<string, unknown> | null;
}

function resolveUserProfile(profileRow: Record<string, unknown> | null): UserProfile {
  const value = profileRow?.user_profile;
  if (value === 'bodybuilder' || value === 'beginner') return value;
  return 'beginner';
}

async function acquireEdgeLock(labReportId: string, expectedUpdatedAt: string | null, source: string) {
  const { data, error } = await supabase.rpc('acquire_lab_report_edge_lock', {
    p_lab_report_id: labReportId,
    p_expected_updated_at: expectedUpdatedAt,
    p_source: source,
  });
  if (error) throw new Error(`Erro ao adquirir lock edge: ${error.message}`);
  return Boolean(data);
}

async function createSignedUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(`Falha ao gerar signed URL: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

async function callOcr(input: { sourceId: string; mimeType: string; fileUrl: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXAM_OCR_TIMEOUT_MS);
  const ocrBaseUrl = resolveExamOcrBaseUrl();

  try {
    const response = await fetch(ocrBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: input.sourceId,
        mime_type: input.mimeType,
        file_url: input.fileUrl,
        language: 'por+eng',
        prefer_native_pdf: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OCR ${response.status}: ${text.slice(0, 250)}`);
    }

    const payload = await response.json() as OcrResponse;
    if (payload.success !== true) throw new Error('OCR retornou success=false');
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function cleanBiomarkers(items: Array<Record<string, unknown>>, profileRow: Record<string, unknown> | null): Biomarker[] {
  const mapped = (items ?? []).map((item) => {
    const markerKey = String(item.marker_key ?? item.marker ?? item.name ?? '').trim().toLowerCase();
    const markerName = String(item.marker_name ?? item.name ?? markerKey ?? 'Marcador');
    const valueNumeric = toNumber(item.value_numeric ?? item.value);
    const referenceMin = toNumber(item.reference_min);
    const referenceMax = toNumber(item.reference_max);
    return {
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
  // OCR can return the same marker twice. Keep the entry with higher confidence score.
  const seen = new Map<string, typeof mapped[number]>();
  for (const row of mapped) {
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
  return enrichBiomarkerEntries(
    Array.from(seen.values()).map((row) => ({
      ...row,
      reference_text_raw: row.reference_text,
      lab_flag: row.flag === 'low' || row.flag === 'high' || row.flag === 'normal' ? row.flag : null,
    })),
    profileRow,
  ) as Biomarker[];
}

async function persistExtraction(labReportId: string, ocr: OcrResponse) {
  const { error } = await supabase.from('lab_report_extractions').insert({
    lab_report_id: labReportId,
    engine: 'exam_ocr_python',
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

async function persistBiomarkers(labReportId: string, biomarkers: Biomarker[]) {
  const { error: deleteError } = await supabase.from('lab_report_biomarkers').delete().eq('lab_report_id', labReportId);
  if (deleteError && !isMissingOptionalTable(deleteError, 'lab_report_biomarkers')) {
    throw new Error(`Falha ao limpar biomarcadores: ${deleteError.message}`);
  }

  if (biomarkers.length > 0) {
    const { error } = await supabase.from('lab_report_biomarkers').insert(
      biomarkers.map((item) => ({
        lab_report_id: labReportId,
        ...item,
        extraction_confidence: item.confidence ?? null,
        review_status: 'machine_only',
        reviewed_value_override: null,
        reviewed_reference_override: null,
        reviewer_note: null,
        released_value: null,
        released_flag: null,
      })),
    );
    if (error && !isMissingOptionalTable(error, 'lab_report_biomarkers')) {
      throw new Error(`Falha ao salvar biomarcadores: ${error.message}`);
    }
  }
}

function computeReadiness(confidenceSummary: Record<string, unknown>, biomarkers: Biomarker[], warnings: string[]) {
  const meanConfidence = toNumber(confidenceSummary?.mean_confidence ?? confidenceSummary?.overall_confidence) ?? 0;
  const hasHardWarning = warnings.some((warning) => /low_confidence|ocr_failed|no_text/i.test(String(warning)));

  if (biomarkers.length === 0) {
    return { ready: false, reason: 'no_biomarkers', meanConfidence };
  }
  if (hasHardWarning || meanConfidence < 0.6) {
    return { ready: false, reason: 'low_confidence', meanConfidence };
  }
  return { ready: true, reason: null, meanConfidence };
}

function toBiomarkerEntries(biomarkers: Biomarker[]): BiomarkerEntry[] {
  return biomarkers.map((item) => ({
    marker_key: String(item.marker_key || '').toLowerCase(),
    marker_name: String(item.marker_name || item.marker_key || 'Marcador'),
    value_numeric: toNumber(item.value_numeric),
    value_text: item.value_text != null ? String(item.value_text) : null,
    unit: item.unit != null ? String(item.unit) : null,
    reference_min: toNumber(item.reference_min),
    reference_max: toNumber(item.reference_max),
    reference_text: item.reference_text != null ? String(item.reference_text) : null,
    flag: item.flag === 'low' || item.flag === 'high' || item.flag === 'normal' ? item.flag : null,
    source_line: item.source_line != null ? String(item.source_line) : null,
    confidence: toNumber(item.confidence),
    reference_text_raw: item.reference_text_raw != null ? String(item.reference_text_raw) : null,
    normalized_reference: item.normalized_reference && typeof item.normalized_reference === 'object'
      ? item.normalized_reference as Record<string, unknown>
      : null,
    lab_flag: item.lab_flag === 'low' || item.lab_flag === 'high' || item.lab_flag === 'normal' ? item.lab_flag : null,
    context_flag: item.context_flag != null ? String(item.context_flag) : null,
    interpretation_mode: item.interpretation_mode != null ? String(item.interpretation_mode) : null,
    monitor_priority: item.monitor_priority != null ? String(item.monitor_priority) : null,
    safety_relevance: typeof item.safety_relevance === 'boolean' ? item.safety_relevance : null,
    feedback_summary: item.feedback_summary != null ? String(item.feedback_summary) : null,
    source_reference_kind: item.source_reference_kind != null ? String(item.source_reference_kind) : null,
  })).filter((row) => row.marker_key);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function resolveStringArray(
  ...candidates: unknown[]
): string[] {
  for (const candidate of candidates) {
    const normalized = normalizeStringArray(candidate);
    if (normalized.length) return normalized;
  }
  return [];
}

function normalizeScores(value: unknown, fallback: Record<string, number>) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};

  return {
    metabolic_score: toNumber(source.metabolic_score) ?? fallback.metabolic_score,
    recovery_score: toNumber(source.recovery_score) ?? fallback.recovery_score,
    hematologic_score: toNumber(source.hematologic_score) ?? fallback.hematologic_score,
    hormonal_score: toNumber(source.hormonal_score) ?? fallback.hormonal_score,
    safety_score: toNumber(source.safety_score) ?? fallback.safety_score,
    lipid_score: toNumber(source.lipid_score) ?? fallback.lipid_score,
    liver_score: toNumber(source.liver_score) ?? fallback.liver_score,
    kidney_score: toNumber(source.kidney_score) ?? fallback.kidney_score,
  };
}

function buildCanonicalAiInsights(
  biomarkers: Biomarker[],
  rawInsights: Record<string, unknown>,
  profileRow: Record<string, unknown> | null,
) {
  const typedBiomarkers = toBiomarkerEntries(biomarkers);
  const healthProfile = buildHealthPerformanceProfile(typedBiomarkers);
  const userProfile = resolveUserProfile(profileRow);
  const clinical = applyClinicalRulesFromBiomarkers(typedBiomarkers, userProfile);
  const hormoneContext = extractHormoneContextFromProfileRow(profileRow);
  const contextualSummary = summarizeMarkerInterpretations(typedBiomarkers);

  const fallbackTraining = healthProfile.training_readiness.level === 'critical'
    ? ['Sinais críticos detectados: reduzir volume e intensidade imediatamente; avaliação médica recomendada.']
    : healthProfile.training_readiness.level === 'caution'
      ? ['Sinais de cautela: modular volume; evitar falha muscular; priorizar recuperação ativa.']
      : healthProfile.training_readiness.level === 'attention'
        ? ['Monitorar fadiga e recuperação; ajuste conservador de progressão de carga.']
        : ['Sem limitações clínicas identificadas. Progressão normal conforme periodização planejada.'];

  const fallbackNutrition = healthProfile.dietary_attention_points.notes.length
    ? healthProfile.dietary_attention_points.notes.slice(0, 5)
    : ['Distribuição equilibrada de macronutrientes conforme objetivo e composição corporal.'];

  const fallbackSupplementation = ['Manter stack base: proteína, creatina e ômega-3 quando compatíveis com objetivos e perfil clínico.'];
  const fallbackRecovery = healthProfile.recovery_risk.notes.length
    ? healthProfile.recovery_risk.notes.slice(0, 4)
    : ['Marcadores de recuperação dentro dos limites esperados.'];
  const fallbackSafety = [
    'Sem diagnóstico médico. Análise orientada a treino e produto. Alterações relevantes devem ser avaliadas por médico.',
    ...healthProfile.safety_flags.notes.slice(0, 3),
  ];
  const fallbackFollowUp = ['Repetir exame no intervalo recomendado pelo profissional de saúde.'];

  const summary = String(rawInsights.summary ?? '').trim()
    || 'Interpretação clínica estruturada gerada a partir dos biomarcadores do exame.';
  const impactOnTraining = resolveStringArray(rawInsights.impact_on_training, rawInsights.training_adjustments, fallbackTraining);
  const impactOnNutrition = resolveStringArray(rawInsights.impact_on_nutrition, rawInsights.nutrition_adjustments, fallbackNutrition);
  const impactOnSupplementation = resolveStringArray(rawInsights.impact_on_supplementation, rawInsights.supplementation_notes, fallbackSupplementation);
  const recoverySignals = resolveStringArray(rawInsights.recovery_signals, fallbackRecovery);
  const safetyNotes = resolveStringArray(rawInsights.safety_notes, fallbackSafety);
  const recommendedFollowUp = resolveStringArray(rawInsights.recommended_follow_up, rawInsights.follow_up_actions, fallbackFollowUp);

  return {
    provider: String(rawInsights.provider ?? 'local'),
    model: rawInsights.model != null ? String(rawInsights.model) : null,
    generation_mode: String(rawInsights.generation_mode ?? 'canonical_health_profile'),
    fallback_reason: rawInsights.fallback_reason != null ? String(rawInsights.fallback_reason) : null,
    summary,
    hormone_context: hormoneContext,
    contextual_summary: contextualSummary,
    marker_interpretations: typedBiomarkers,
    scores: normalizeScores(rawInsights.scores, healthProfile.scores),
    health_profile: {
      metabolic_health: healthProfile.metabolic_health,
      lipid_health: healthProfile.lipid_health,
      liver_health: healthProfile.liver_health,
      kidney_hydration: healthProfile.kidney_hydration,
      hematologic_status: healthProfile.hematologic_status,
      thyroid_status: healthProfile.thyroid_status,
      androgen_status: healthProfile.androgen_status,
      inflammation_status: healthProfile.inflammation_status,
      micronutrient_status: healthProfile.micronutrient_status,
      training_readiness: healthProfile.training_readiness,
      recovery_risk: healthProfile.recovery_risk,
      dietary_attention_points: healthProfile.dietary_attention_points,
      safety_flags: healthProfile.safety_flags,
    },
    clinical_flags: clinical.clinicalFlags,
    critical_flags: clinical.criticalFlags,
    clinical_mode: clinical.mode,
    evaluated_with_profile: userProfile,
    impact_on_training: impactOnTraining,
    impact_on_nutrition: impactOnNutrition,
    impact_on_supplementation: impactOnSupplementation,
    recovery_signals: recoverySignals,
    safety_notes: safetyNotes,
    recommended_follow_up: recommendedFollowUp,
    // Legacy aliases preserved for compatibility with older readers.
    training_adjustments: impactOnTraining,
    nutrition_adjustments: impactOnNutrition,
    supplementation_notes: impactOnSupplementation,
    follow_up_actions: recommendedFollowUp,
  };
}

function buildRuleBasedFallback(biomarkers: Biomarker[], reason: string) {
  const byKey = new Map<string, number>();
  for (const biomarker of biomarkers) {
    if (biomarker.value_numeric !== null) byKey.set(biomarker.marker_key, biomarker.value_numeric);
  }

  const glucose = byKey.get('glucose');
  const hba1c = byKey.get('hba1c');
  const ldl = byKey.get('ldl');
  const creatinine = byKey.get('creatinine');

  const metabolicScore = glucose && glucose > 110 ? 45 : 78;
  const recoveryScore = hba1c && hba1c > 5.7 ? 55 : 80;
  const safetyScore = (ldl && ldl > 160) || (creatinine && creatinine > 1.5) ? 42 : 82;

  return {
    provider: 'local',
    generation_mode: 'rule_based_fallback',
    fallback_reason: reason,
    summary: 'Insights gerados em modo degradado porque a interpretação via Groq não estava disponível.',
    scores: {
      metabolic_score: metabolicScore,
      recovery_score: recoveryScore,
      safety_score: safetyScore,
    },
    training_adjustments: [
      'Reduzir proximidade da falha se sinais de segurança ou recuperação estiverem piores.',
      'Priorizar consistência, técnica e monitoramento de fadiga até nova leitura clínica.',
    ],
    nutrition_adjustments: [
      'Priorizar densidade nutricional, proteína adequada e distribuição consistente de carboidratos.',
    ],
    supplementation_notes: [
      'Manter apenas stack conservador até nova interpretação completa do exame.',
    ],
    follow_up_actions: [
      'Reprocessar quando GROQ_API_KEY estiver configurada e revisar o exame em contexto clínico.',
    ],
  };
}

function extractJsonObject(text: string) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Groq não retornou JSON válido');
  }
  return JSON.parse(text.slice(first, last + 1));
}

async function callGroqInsights(input: { biomarkers: Biomarker[]; confidenceSummary: Record<string, unknown>; profileRow: Record<string, unknown> | null }) {
  const biomarkerPayload = input.biomarkers.map((item) => ({
    marker_key: item.marker_key,
    marker_name: item.marker_name,
    value_numeric: item.value_numeric,
    value_text: item.value_text,
    unit: item.unit,
    reference_min: item.reference_min,
    reference_max: item.reference_max,
    flag: item.flag,
    confidence: item.confidence,
    lab_flag: item.lab_flag ?? item.flag,
    context_flag: item.context_flag,
    feedback_summary: item.feedback_summary,
  }));
  const hormoneContext = extractHormoneContextFromProfileRow(input.profileRow);
  const userProfile = resolveUserProfile(input.profileRow);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Você é especialista em medicina esportiva e análise laboratorial aplicada ao fisiculturismo, com expertise em atletas naturais e hormonizados (TRT e uso assistido).',
            '',
            'CONTEXTO HORMONAL DO USUÁRIO — aplique antes de interpretar qualquer marcador:',
            '- uses_exogenous_hormones=false (natural): use ranges laboratoriais padrão + benchmarks esportivos (ferritina > 50, vitamina D > 40 ng/mL, testosterona > 500 ng/dL para performance ideal).',
            '- hormone_context_type=trt: testosterona elevada acima do range é esperada. LH/FSH próximos de zero = supressão esperada, não patologia. Foco em segurança: hematócrito, E2, PSA, HDL, enzimas hepáticas.',
            '- hormone_context_type=assisted: testosterona pode estar 1500–3500+ ng/dL — contextualizar, não alarmar. LH/FSH zerados = esperado. Alertas de segurança são ainda mais rigorosos: eritrocitose, hepatotoxicidade, dislipidemia grave, prolactina com 19-nors.',
            '',
            'MARCADORES DE SEGURANÇA — NUNCA normalizáveis independente do contexto:',
            '- Hematócrito > 54% → risco trombótico crítico, ação imediata.',
            '- AST ou ALT > 3× limite superior → hepatotoxicidade real (CK elevada de treino não é marcador hepático — use ALT/GGT).',
            '- PSA duplicado em 6 meses ou PSA > 4 ng/mL → rastreamento urgente.',
            '- HDL < 25 mg/dL → risco cardiovascular elevado mesmo em contexto assistido.',
            '- Creatinina > 1,5 mg/dL (excluindo suplementação de creatina) → função renal comprometida.',
            '- Glicose em jejum > 126 mg/dL → critério diagnóstico de diabetes.',
            '- Prolactina > 50 ng/mL → investigação imediata.',
            '',
            'BENCHMARKS ESPECÍFICOS PARA ATLETAS (superior ao range populacional):',
            '- Ferritina: < 50 ng/mL compromete performance aeróbica mesmo sem anemia clínica; ideal > 100 ng/mL.',
            '- Vitamina D: < 40 ng/mL é insuficiência para atleta (range pop. geral subestima); ideal 50–80 ng/mL.',
            '- Cortisol matinal < 10 mcg/dL → sinal de supressão HPA por overtraining; reduzir volume antes de suplementar.',
            '- CK muito elevada após treino intenso = resposta fisiológica esperada; não confundir com marcador hepático.',
            '- Testosterona total < 400 ng/dL em natural → impacto real em recuperação, composição corporal e libido.',
            '- SHBG > 60 nmol/L → reduz testosterona livre mesmo com total normal; mais relevante que testosterona total isolada.',
            '- Estradiol (E2) < 15 pg/mL → dor articular, recuperação lenta, humor instável.',
            '- Estradiol (E2) > 60 pg/mL → retenção hídrica, risco de ginecomastia, instabilidade de humor.',
            '- Prolactina > 25 ng/mL → investigar uso de 19-nor (nandrolona, trembolona) ou causa hipofisária.',
            '- LH/FSH baixos em natural → comprometimento do eixo; investigar causa.',
            '',
            'INTERPRETAÇÃO POR CONTEXTO HORMONAL:',
            'TRT: alvo testosterona 600–1000 ng/dL; E2 alvo 20–40 pg/mL; monitorar hematócrito a cada ciclo; HDL < 35 mg/dL é preocupante; PSA semestral.',
            'Assistido: testosterona suprafisiológica documentada; foco em lipídios (HDL pode despencar), eritrocitose, enzimas hepáticas, pressão arterial, prolactina com 19-nors.',
            '',
            'Retorne JSON estrito com as chaves: summary, scores, training_adjustments, nutrition_adjustments, supplementation_notes, recovery_signals, safety_notes, follow_up_actions.',
            'scores deve conter metabolic_score, recovery_score, hematologic_score, hormonal_score, safety_score de 0 a 100.',
            'summary: 2–3 frases diretas, sem dramatizar, orientadas para o contexto esportivo real do usuário.',
            'Todos os textos em português do Brasil, curtos e acionáveis.',
            'Nunca diagnostique. Use "sinais compatíveis com", "sugere", "pode indicar".',
            'Nunca invente biomarcadores, valores ou ranges não recebidos.',
            'Se dados insuficientes: seja conservador e registre em safety_notes/follow_up_actions.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            hormone_context: hormoneContext,
            user_profile: userProfile,
            confidence_summary: input.confidenceSummary,
            biomarkers: biomarkerPayload,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Groq ${response.status}: ${text.slice(0, 250)}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const content = String((payload.choices as Array<Record<string, unknown>>)?.[0]?.message?.content ?? '');
  const parsed = extractJsonObject(content);
  return {
    provider: 'groq',
    model: GROQ_MODEL,
    generation_mode: 'structured_biomarkers',
    ...parsed,
  };
}

async function finalizeNeedsReview(labReportId: string, ocr: OcrResponse, reason: string, biomarkers: Biomarker[]) {
  await updateLabReportWithParseStatusFallback(
    labReportId,
    {
      status: 'needs_review',
      parse_status: 'processed',
      extraction_mode: ocr.extraction_mode,
      source_type: ocr.source_type,
      normalized_payload: buildNormalizedPayload(ocr, biomarkers),
      confidence_summary: ocr.confidence_summary || {},
      processing_error: reason,
      processed_at: new Date().toISOString(),
      exam_date: resolveExamDate(ocr),
      is_valid: false,
      last_orchestrator_note: reason,
    },
    'Falha ao salvar needs_review',
  );
}

async function finalizeAnalyzed(
  labReportId: string,
  ocr: OcrResponse,
  biomarkers: Biomarker[],
  aiInsights: Record<string, unknown>,
  isFallback: boolean,
) {
  await updateLabReportWithParseStatusFallback(
    labReportId,
    {
      status: 'analyzed',
      parse_status: 'processed',
      extraction_mode: ocr.extraction_mode,
      source_type: ocr.source_type,
      normalized_payload: buildNormalizedPayload(ocr, biomarkers),
      confidence_summary: ocr.confidence_summary || {},
      ai_insights: aiInsights,
      processing_error: isFallback ? 'groq_unavailable_fallback_used' : null,
      processed_at: new Date().toISOString(),
      exam_date: resolveExamDate(ocr),
      is_valid: true,
      last_orchestrator_note: isFallback ? 'fallback_analyzed' : 'analyzed',
    },
    'Falha ao salvar analyzed',
  );
}

async function finalizeAsFailed(labReportId: string, reason: string) {
  await supabase
    .from('lab_reports')
    .update({
      status: 'failed',
      parse_status: 'failed',
      processing_error: reason.slice(0, 280),
      processed_at: new Date().toISOString(),
      is_valid: false,
      last_orchestrator_note: 'failed',
    })
    .eq('id', labReportId);
}

async function processSingleReport(input: { labReportId: string; expectedUpdatedAt?: string | null; dispatchSource: string }) {
  const report = await fetchLabReport(input.labReportId);
  if (!report) {
    return { ok: false, status: 404, error: 'lab_report_not_found' };
  }

  // Guard: prevent infinite retry loop when OCR or downstream steps fail repeatedly.
  const MAX_PROCESSING_ATTEMPTS = 5;
  if ((report.processing_attempts ?? 0) >= MAX_PROCESSING_ATTEMPTS) {
    await finalizeAsFailed(
      input.labReportId,
      `max_retries_exceeded_after_${report.processing_attempts}_attempts`,
    );
    await logEvent(input.labReportId, 'max_retries_exceeded', 'error', {
      dispatchSource: input.dispatchSource,
      attempts: report.processing_attempts,
    });
    return { ok: false, error: 'max_retries_exceeded' };
  }

  if (String(report.status) === 'analyzed') {
    await logEvent(input.labReportId, 'already_analyzed', 'info', { dispatchSource: input.dispatchSource });
    return { ok: true, skipped: true, reason: 'already_analyzed' };
  }

  const lockAcquired = await acquireEdgeLock(input.labReportId, input.expectedUpdatedAt ?? null, input.dispatchSource);
  if (!lockAcquired) {
    await logEvent(input.labReportId, 'lock_not_acquired', 'info', {
      dispatchSource: input.dispatchSource,
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      currentStatus: report.status,
    });
    return { ok: true, skipped: true, reason: 'lock_not_acquired' };
  }

  await logEvent(input.labReportId, 'processing_started', 'info', { dispatchSource: input.dispatchSource });

  // Wrap the entire pipeline so that any crash after lock acquisition
  // always leaves the report in 'failed' — never stuck in 'processing'.
  try {
    const profileRow = await fetchProfileRow(String(report.user_id));
    const signedUrl = await createSignedUrl(String(report.storage_bucket || LAB_REPORTS_BUCKET), String(report.storage_path || ''));
    const ocr = await callOcr({
      sourceId: input.labReportId,
      mimeType: String(report.mime_type || report.file_type || ''),
      fileUrl: signedUrl,
    });

    await persistExtraction(input.labReportId, ocr);
    const biomarkers = cleanBiomarkers(ocr.biomarkers_detected || [], profileRow);
    await persistBiomarkers(input.labReportId, biomarkers);

    let insights: Record<string, unknown>;
    let fallback = false;
    try {
      if (!GROQ_API_KEY) throw new Error('missing_groq_api_key');
      insights = await callGroqInsights({ biomarkers, confidenceSummary: ocr.confidence_summary || {}, profileRow });
    } catch (error) {
      fallback = true;
      insights = buildRuleBasedFallback(biomarkers, error instanceof Error ? error.message : 'groq_failed');
      await logEvent(input.labReportId, 'groq_fallback_used', 'warn', {
        dispatchSource: input.dispatchSource,
        reason: error instanceof Error ? error.message : 'groq_failed',
      });
    }

    const canonicalInsights = buildCanonicalAiInsights(biomarkers, insights, profileRow);
    const finalized = await persistCanonicalMachineResult({
      admin: supabase,
      labReportId: input.labReportId,
      ocr,
      biomarkers,
      aiInsights: canonicalInsights,
      processingNote: fallback ? 'groq_unavailable_fallback_used' : null,
      releasedByRule: 'auto_machine_release',
    });
    await logEvent(input.labReportId, finalized.decision.legacyStatus === 'analyzed' ? 'released_to_patient' : 'needs_clinical_review', finalized.decision.releaseAllowed ? 'info' : 'warn', {
      dispatchSource: input.dispatchSource,
      biomarkers: biomarkers.length,
      fallback,
      canonicalStatus: finalized.decision.canonicalStatus,
      reviewStatus: finalized.decision.reviewStatus,
      warnings: finalized.decision.warnings,
    });

    return { ok: true, status: finalized.decision.legacyStatus, canonicalStatus: finalized.decision.canonicalStatus, biomarkers: biomarkers.length, fallback };
  } catch (pipelineError) {
    // Any error after lock acquisition → mark failed so the report is never stranded.
    const reason = pipelineError instanceof Error ? pipelineError.message : 'pipeline_error';
    await finalizeAsFailed(input.labReportId, reason);
    await logEvent(input.labReportId, 'pipeline_failed', 'error', {
      dispatchSource: input.dispatchSource,
      reason: reason.slice(0, 200),
    });
    return { ok: false, status: 'failed', reason };
  }
}

async function dispatchWatchdog(limit: number, dispatchSource: string) {
  const processingStaleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const uploadedRecoveryBefore = new Date(Date.now() - UPLOADED_RECOVERY_MINUTES * 60 * 1000).toISOString();
  const cappedLimit = Math.max(1, Math.min(limit, 25));
  const [uploadedResult, processingResult] = await Promise.all([
    supabase
      .from('lab_reports')
      .select('id,updated_at')
      .eq('status', 'uploaded')
      .lt('updated_at', uploadedRecoveryBefore)
      .order('updated_at', { ascending: true })
      .limit(cappedLimit),
    supabase
      .from('lab_reports')
      .select('id,updated_at')
      .eq('status', 'processing')
      .lt('updated_at', processingStaleBefore)
      .order('updated_at', { ascending: true })
      .limit(cappedLimit),
  ]);

  if (uploadedResult.error) throw new Error(`Falha ao listar uploaded para recuperação: ${uploadedResult.error.message}`);
  if (processingResult.error) throw new Error(`Falha ao listar processing preso: ${processingResult.error.message}`);

  const data = [...(uploadedResult.data ?? []), ...(processingResult.data ?? [])]
    .sort((a, b) => String(a.updated_at ?? '').localeCompare(String(b.updated_at ?? '')))
    .slice(0, cappedLimit);

  const baseUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/lab-report-orchestrator`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };

  let dispatched = 0;
  for (const row of data) {
    const body = JSON.stringify({
      labReportId: row.id,
      expectedUpdatedAt: row.updated_at,
      dispatchSource,
    });

    if (SUPABASE_ANON_KEY) {
      // Fire-and-forget, but capture errors in pipeline_events for observability.
      fetch(baseUrl, { method: 'POST', headers, body })
        .then(async (resp) => {
          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            await logEvent(String(row.id), 'watchdog_dispatch_http_error', 'warn', {
              dispatchSource,
              httpStatus: resp.status,
              body: text.slice(0, 200),
            }).catch(() => null);
          }
        })
        .catch(async (err) => {
          await logEvent(String(row.id), 'watchdog_dispatch_network_error', 'warn', {
            dispatchSource,
            reason: err instanceof Error ? err.message : 'unknown',
          }).catch(() => null);
        });
      dispatched += 1;
      await logEvent(String(row.id), 'watchdog_dispatched', 'info', { dispatchSource, mode: 'async' });
      continue;
    }

    await processSingleReport({
      labReportId: String(row.id),
      expectedUpdatedAt: row.updated_at ? String(row.updated_at) : null,
      dispatchSource,
    });
    dispatched += 1;
  }

  return { scanned: data.length, dispatched };
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json(200, { ok: true });
    if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

    const url = new URL(req.url);
    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const isWatchdog = url.pathname.endsWith('/watchdog') || payload.action === 'watchdog';

    if (isWatchdog) {
      const limit = Number(payload.limit ?? 10);
      const result = await dispatchWatchdog(limit, String(payload.dispatchSource ?? 'pg_cron_watchdog'));
      return json(200, { ok: true, mode: 'watchdog', ...result });
    }

    const labReportId = String(payload.labReportId ?? payload.record?.id ?? '').trim();
    if (!labReportId) return json(400, { ok: false, error: 'labReportId_required' });

    const result = await processSingleReport({
      labReportId,
      expectedUpdatedAt: payload.expectedUpdatedAt ? String(payload.expectedUpdatedAt) : null,
      dispatchSource: String(payload.dispatchSource ?? 'edge_direct'),
    });

    return json(result.ok ? 200 : Number(result.status ?? 500), result as Record<string, unknown>);
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : 'unexpected_error',
    });
  }
});
