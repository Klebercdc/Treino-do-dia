import type { BiomarkerEntry, NormalizedReference } from '../../../core/labs/labTypes'

export type CanonicalLabStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'queued'
  | 'ocr_running'
  | 'extracted_machine'
  | 'needs_clinical_review'
  | 'reviewed_locked'
  | 'released_to_patient'
  | 'failed'

export type CanonicalReviewStatus =
  | 'machine_only'
  | 'awaiting_review'
  | 'reviewed'
  | 'rejected'
  | 'released'

type OcrLike = {
  extraction_mode?: string | null
  source_type?: string | null
  raw_text?: string | null
  pages?: unknown[]
  blocks?: unknown[]
  rows?: unknown[]
  warnings?: string[]
  metadata?: Record<string, unknown> | null
  confidence_summary?: Record<string, unknown> | null
}

type MachineFinalizationInput = {
  admin: {
    from: (table: string) => any
  }
  labReportId: string
  ocr: OcrLike
  biomarkers: Array<Record<string, unknown>>
  aiInsights: Record<string, unknown> | null
  processingNote?: string | null
  releasedByRule?: string | null
}

export type ClinicalGateDecision = {
  releaseAllowed: boolean
  canonicalStatus: CanonicalLabStatus
  legacyStatus: 'analyzed' | 'needs_review'
  parseStatus: 'processed'
  reviewStatus: CanonicalReviewStatus
  isValid: boolean
  warnings: string[]
  primaryReason: string | null
}

const MIN_MEAN_CONFIDENCE = 0.6
const MIN_BIOMARKER_CONFIDENCE = 0.75
const MIN_CRITICAL_BIOMARKER_CONFIDENCE = 0.95

const HARD_WARNING_RE = /low_confidence|ocr_failed|no_text/i
const PHASE_REFERENCE_RE = /\b(folicular|lutea|luteal|ovulatoria|ovulat|gestante|gravidez|trimestre|menopausa|pos-menopausa|pós-menopausa|fase)\b/i

const CRITICAL_MARKERS = new Set([
  'glucose',
  'hba1c',
  'insulin',
  'total_cholesterol',
  'hdl_cholesterol',
  'ldl_cholesterol',
  'triglycerides',
  'ast',
  'alt',
  'ggt',
  'creatinine',
  'urea',
  'egfr',
  'potassium',
  'sodium',
  'magnesium',
  'calcium',
  'hemoglobin',
  'hematocrit',
  'ferritin',
  'tsh',
  't4_free',
  'testosterone_total',
  'testosterone_free',
  'lh',
  'fsh',
  'shbg',
  'estradiol',
  'cortisol',
  'dhea_s',
  'crp',
  'homocysteine',
  'vitamin_d',
  'vitamin_b12',
  'psa_total',
  'psa_free',
])

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
    : []
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)))
}

export function isMissingOptionalRelation(error: unknown, table: string): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : ''
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : ''
  return (code === 'PGRST205' || code === '42P01' || !code)
    && new RegExp(`(?:table|relation) ['"]?public\\.${table}['"]?(?: in the schema cache)? (?:does not exist|was not found)|could not find the table ['"]?public\\.${table}['"]?`, 'i').test(message)
}

export function isParseStatusConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : ''
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : ''
  return code === '23514' && /lab_reports_parse_status_check/i.test(message)
}

export async function updateLabReportWithParseStatusFallback(
  admin: { from: (table: string) => any },
  labReportId: string,
  values: Record<string, unknown>,
  failureLabel: string,
): Promise<void> {
  const first = await admin
    .from('lab_reports')
    .update(values)
    .eq('id', labReportId)

  if (!isParseStatusConstraintViolation(first.error)) {
    if (first.error) throw new Error(`${failureLabel}: ${first.error.message}`)
    return
  }

  const fallbackValues = { ...values }
  delete fallbackValues.parse_status

  const fallback = await admin
    .from('lab_reports')
    .update(fallbackValues)
    .eq('id', labReportId)

  if (fallback.error) throw new Error(`${failureLabel}: ${fallback.error.message}`)
}

export function buildNormalizedPayload(ocr: OcrLike, biomarkers: Array<Record<string, unknown>>) {
  return {
    biomarkers,
    extraction: {
      engine: 'exam_ocr_python',
      extraction_mode: ocr.extraction_mode || null,
      raw_text: ocr.raw_text || null,
      pages: ocr.pages || [],
      blocks: ocr.blocks || [],
      rows: ocr.rows || [],
      warnings: ocr.warnings || [],
      metadata: ocr.metadata || {},
      confidence_summary: ocr.confidence_summary || {},
    },
  }
}

function biomarkerFromRecord(item: Record<string, unknown>): BiomarkerEntry {
  const normalizedReference = asRecord(item.normalized_reference) as NormalizedReference | null
  const sourceReferenceKind = item.source_reference_kind != null ? String(item.source_reference_kind) : null
  return {
    marker_key: String(item.marker_key || '').trim().toLowerCase(),
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
    normalized_reference: normalizedReference,
    lab_flag: item.lab_flag === 'low' || item.lab_flag === 'high' || item.lab_flag === 'normal' ? item.lab_flag : null,
    context_flag: item.context_flag != null ? String(item.context_flag) : null,
    interpretation_mode: item.interpretation_mode === 'natural' || item.interpretation_mode === 'trt' || item.interpretation_mode === 'assisted' || item.interpretation_mode === 'unknown'
      ? item.interpretation_mode
      : null,
    monitor_priority: item.monitor_priority === 'low' || item.monitor_priority === 'medium' || item.monitor_priority === 'high'
      ? item.monitor_priority
      : null,
    safety_relevance: typeof item.safety_relevance === 'boolean' ? item.safety_relevance : null,
    feedback_summary: item.feedback_summary != null ? String(item.feedback_summary) : null,
    source_reference_kind: sourceReferenceKind,
  }
}

function buildGateWarning(marker: BiomarkerEntry, reason: string) {
  return `${marker.marker_key}:${reason}`
}

function isReferenceAmbiguous(marker: BiomarkerEntry): boolean {
  const normalizedReference = marker.normalized_reference
  const rawText = String(marker.reference_text_raw || marker.reference_text || '').trim()
  if (!rawText) return false
  if (normalizedReference?.matched_by === 'ambiguous') return true
  if (marker.source_reference_kind === 'ambiguous') return true
  if (PHASE_REFERENCE_RE.test(rawText) && (!normalizedReference || normalizedReference.matched_by === 'text_only')) {
    return true
  }
  return false
}

function needsReferenceResolution(marker: BiomarkerEntry): boolean {
  const normalizedReference = marker.normalized_reference
  if (normalizedReference?.matched_by === 'ambiguous') return true
  if (normalizedReference?.matched_by === 'text_only') return true
  if (!normalizedReference && marker.reference_min == null && marker.reference_max == null && (marker.reference_text_raw || marker.reference_text)) {
    return true
  }
  return false
}

function collectBiomarkerGateWarnings(marker: BiomarkerEntry): string[] {
  const warnings: string[] = []
  const critical = CRITICAL_MARKERS.has(marker.marker_key)
  const confidence = marker.confidence ?? 0

  if (confidence < MIN_BIOMARKER_CONFIDENCE) warnings.push(buildGateWarning(marker, 'low_extraction_confidence'))
  if (critical && confidence < MIN_CRITICAL_BIOMARKER_CONFIDENCE) warnings.push(buildGateWarning(marker, 'critical_low_confidence'))
  if (critical && !marker.unit) warnings.push(buildGateWarning(marker, 'missing_unit'))
  if (critical && isReferenceAmbiguous(marker)) warnings.push(buildGateWarning(marker, 'ambiguous_reference'))
  if (critical && needsReferenceResolution(marker)) warnings.push(buildGateWarning(marker, 'unresolved_reference'))

  return warnings
}

export function decideClinicalGate(input: {
  biomarkers: Array<Record<string, unknown>>
  confidenceSummary?: Record<string, unknown> | null
  extractionWarnings?: string[]
}): ClinicalGateDecision {
  const meanConfidence = toNumber(input.confidenceSummary?.mean_confidence ?? input.confidenceSummary?.overall_confidence) ?? 0
  const extractionWarnings = normalizeStringArray(input.extractionWarnings)
  const gateWarnings = [...extractionWarnings]

  if (!input.biomarkers.length) {
    return {
      releaseAllowed: false,
      canonicalStatus: 'needs_clinical_review',
      legacyStatus: 'needs_review',
      parseStatus: 'processed',
      reviewStatus: 'awaiting_review',
      isValid: false,
      warnings: ['no_biomarkers', ...gateWarnings],
      primaryReason: 'no_biomarkers',
    }
  }

  if (meanConfidence < MIN_MEAN_CONFIDENCE || extractionWarnings.some((item) => HARD_WARNING_RE.test(item))) {
    return {
      releaseAllowed: false,
      canonicalStatus: 'needs_clinical_review',
      legacyStatus: 'needs_review',
      parseStatus: 'processed',
      reviewStatus: 'awaiting_review',
      isValid: false,
      warnings: uniqueStrings(['low_confidence', ...gateWarnings]),
      primaryReason: 'low_confidence',
    }
  }

  const biomarkerWarnings = input.biomarkers
    .map((item) => biomarkerFromRecord(item))
    .flatMap((marker) => collectBiomarkerGateWarnings(marker))

  if (biomarkerWarnings.length) {
    const warnings = uniqueStrings([...gateWarnings, ...biomarkerWarnings])
    return {
      releaseAllowed: false,
      canonicalStatus: 'needs_clinical_review',
      legacyStatus: 'needs_review',
      parseStatus: 'processed',
      reviewStatus: 'awaiting_review',
      isValid: false,
      warnings,
      primaryReason: warnings[0] || 'needs_clinical_review',
    }
  }

  return {
    releaseAllowed: true,
    canonicalStatus: 'released_to_patient',
    legacyStatus: 'analyzed',
    parseStatus: 'processed',
    reviewStatus: 'released',
    isValid: true,
    warnings: uniqueStrings(gateWarnings),
    primaryReason: null,
  }
}

function buildMachineSnapshot(input: {
  version: number
  createdAt: string
  decision: ClinicalGateDecision
  ocr: OcrLike
  biomarkers: Array<Record<string, unknown>>
  aiInsights: Record<string, unknown> | null
}) {
  return {
    version: input.version,
    snapshot_type: 'machine',
    created_at: input.createdAt,
    canonical_status: input.decision.canonicalStatus,
    legacy_status: input.decision.legacyStatus,
    review_status: input.decision.reviewStatus,
    warnings: input.decision.warnings,
    confidence_summary: input.ocr.confidence_summary || {},
    extraction: {
      engine: 'exam_ocr_python',
      extraction_mode: input.ocr.extraction_mode || null,
      source_type: input.ocr.source_type || null,
      warnings: input.ocr.warnings || [],
      metadata: input.ocr.metadata || {},
    },
    biomarkers: input.biomarkers,
    ai_insights: input.aiInsights,
  }
}

function buildReleasedSnapshot(machineSnapshot: Record<string, unknown>, createdAt: string, releasedByRule: string) {
  return {
    ...machineSnapshot,
    snapshot_type: 'released',
    released_at: createdAt,
    released_by_rule: releasedByRule,
  }
}

async function appendSnapshotVersion(
  admin: { from: (table: string) => any },
  labReportId: string,
  version: number,
  snapshotKind: 'machine' | 'released',
  snapshot: Record<string, unknown>,
) {
  const insertResult = await admin
    .from('lab_report_snapshot_versions')
    .insert({
      lab_report_id: labReportId,
      version,
      snapshot_kind: snapshotKind,
      snapshot,
    })

  if (insertResult.error && !isMissingOptionalRelation(insertResult.error, 'lab_report_snapshot_versions')) {
    throw new Error(`Falha ao persistir ${snapshotKind}_snapshot: ${insertResult.error.message}`)
  }
}

async function updateBiomarkerReviewProjection(
  admin: { from: (table: string) => any },
  labReportId: string,
  decision: ClinicalGateDecision,
) {
  const updateResult = await admin
    .from('lab_report_biomarkers')
    .update({
      review_status: decision.reviewStatus,
    })
    .eq('lab_report_id', labReportId)

  if (updateResult.error && !isMissingOptionalRelation(updateResult.error, 'lab_report_biomarkers')) {
    throw new Error(`Falha ao projetar review_status em biomarcadores: ${updateResult.error.message}`)
  }
}

export async function persistCanonicalMachineResult(input: MachineFinalizationInput): Promise<{
  decision: ClinicalGateDecision
  version: number
  machineSnapshot: Record<string, unknown>
  releasedSnapshot: Record<string, unknown> | null
}> {
  const nowIso = new Date().toISOString()
  const current = await input.admin
    .from('lab_reports')
    .select('id,version')
    .eq('id', input.labReportId)
    .maybeSingle()

  if (current.error) throw new Error(`Falha ao carregar versão do lab_report: ${current.error.message}`)

  const version = Math.max(0, Number(current.data?.version || 0)) + 1
  const decision = decideClinicalGate({
    biomarkers: input.biomarkers,
    confidenceSummary: input.ocr.confidence_summary || {},
    extractionWarnings: input.ocr.warnings || [],
  })

  const machineSnapshot = buildMachineSnapshot({
    version,
    createdAt: nowIso,
    decision,
    ocr: input.ocr,
    biomarkers: input.biomarkers,
    aiInsights: input.aiInsights,
  })
  const releasedSnapshot = decision.releaseAllowed
    ? buildReleasedSnapshot(machineSnapshot, nowIso, input.releasedByRule || 'auto_machine_release')
    : null

  await updateLabReportWithParseStatusFallback(
    input.admin,
    input.labReportId,
    {
      status: decision.legacyStatus,
      parse_status: decision.parseStatus,
      canonical_status: decision.canonicalStatus,
      review_status: decision.reviewStatus,
      extraction_mode: input.ocr.extraction_mode || null,
      source_type: input.ocr.source_type || null,
      normalized_payload: buildNormalizedPayload(input.ocr, input.biomarkers),
      confidence_summary: input.ocr.confidence_summary || {},
      ai_insights: decision.releaseAllowed ? input.aiInsights : null,
      processing_error: decision.releaseAllowed ? (input.processingNote ?? null) : (decision.primaryReason || input.processingNote || 'needs_clinical_review'),
      processed_at: nowIso,
      is_valid: decision.isValid,
      version,
      machine_snapshot: machineSnapshot,
      reviewed_snapshot: null,
      released_snapshot: releasedSnapshot,
      released_at: releasedSnapshot ? nowIso : null,
      released_by_rule: releasedSnapshot ? (input.releasedByRule || 'auto_machine_release') : null,
      last_orchestrator_note: decision.canonicalStatus,
    },
    'Falha ao persistir resultado canônico do exame',
  )

  await appendSnapshotVersion(input.admin, input.labReportId, version, 'machine', machineSnapshot)
  if (releasedSnapshot) {
    await appendSnapshotVersion(input.admin, input.labReportId, version, 'released', releasedSnapshot)
  }
  await updateBiomarkerReviewProjection(input.admin, input.labReportId, decision)

  return {
    decision,
    version,
    machineSnapshot,
    releasedSnapshot,
  }
}
