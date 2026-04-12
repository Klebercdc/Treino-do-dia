import type { BiomarkerEntry, HormoneContextProfile, HormoneContextType, NormalizedReference } from './labTypes'

type GenericRecord = Record<string, unknown>

type ReferenceCandidate = {
  kind: NormalizedReference['kind']
  min: number | null
  max: number | null
  rawText: string
  sex: 'male' | 'female' | 'any'
  minAge: number | null
  maxAge: number | null
  matchedBy: NormalizedReference['matched_by']
  mentionsAdult: boolean
}

const RANGE_RE = /(-?\d+(?:[.,]\d+)?)\s*(?:a|até|-)\s*(-?\d+(?:[.,]\d+)?)/i
const LESS_THAN_RE = /(?:inferior|menor|abaixo|less than|below)\s+(?:a|de|que|than)?\s*(-?\d+(?:[.,]\d+)?)(?!\s*anos?\b)/i
const GREATER_THAN_RE = /(?:superior|maior|acima|greater than|above)\s+(?:a|de|que|than)?\s*(-?\d+(?:[.,]\d+)?)(?!\s*anos?\b)/i
const PHASE_REFERENCE_RE = /\b(folicular|lutea|luteal|ovulatoria|ovulat|gestante|gravidez|trimestre|menopausa|pos-menopausa|pós-menopausa|fase)\b/i

const HORMONE_MARKERS = new Set([
  'testosterone_total',
  'testosterone_free',
  'lh',
  'fsh',
  'shbg',
  'estradiol',
  'dht',
  'prolactin',
])

const SAFETY_MARKERS = new Set([
  'hdl_cholesterol',
  'ldl_cholesterol',
  'total_cholesterol',
  'triglycerides',
  'hemoglobin',
  'hematocrit',
  'rbc',
  'erythrocytes',
  'creatinine',
  'urea',
  'ast',
  'alt',
  'ggt',
  'psa_total',
  'psa_free',
  'glucose',
  'hba1c',
  'sodium',
  'potassium',
  'magnesium',
  'calcium',
  'wbc',
  'leukocytes',
  'lymphocytes_percent',
  'lymphocytes_absolute',
])

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : String(value)
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'sim'].includes(normalized)) return true
      if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false
    }
  }
  return null
}

function normalizeSex(value: unknown): 'male' | 'female' | 'other' | 'unknown' {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'unknown'
  if (['male', 'masculino', 'homem', 'man', 'm'].includes(raw)) return 'male'
  if (['female', 'feminino', 'mulher', 'woman', 'f'].includes(raw)) return 'female'
  if (['other', 'outro'].includes(raw)) return 'other'
  return 'unknown'
}

function extractAge(source: GenericRecord, config: GenericRecord): number | null {
  const directAge = toNumber(source.idade ?? source.age ?? config.idade ?? config.age)
  if (directAge != null) return directAge

  const birthDate = firstString(source.birth_date, source.birthDate, config.birth_date, config.birthDate)
  if (!birthDate) return null

  const birth = new Date(birthDate)
  if (!Number.isFinite(birth.getTime())) return null

  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1
  return age >= 0 ? age : null
}

export function extractHormoneContextFromProfileRow(profileRow?: GenericRecord | null): HormoneContextProfile {
  const config = profileRow?.config && typeof profileRow.config === 'object'
    ? profileRow.config as GenericRecord
    : {}

  const hormoneContextType = firstString(
    profileRow?.hormone_context_type,
    config.hormone_context_type,
    config.hormoneContextType,
  )

  const normalizedType: HormoneContextType =
    hormoneContextType === 'natural' || hormoneContextType === 'trt' || hormoneContextType === 'assisted' || hormoneContextType === 'unknown'
      ? hormoneContextType
      : 'unknown'

  const usesExogenousHormones = firstBoolean(
    profileRow?.uses_exogenous_hormones,
    config.uses_exogenous_hormones,
    config.usesExogenousHormones,
  )

  const declaredCompoundsRaw = profileRow?.declared_compounds ?? config.declared_compounds ?? config.declaredCompounds
  const declaredCompounds = Array.isArray(declaredCompoundsRaw)
    ? declaredCompoundsRaw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : typeof declaredCompoundsRaw === 'string'
      ? declaredCompoundsRaw.split(',').map((item) => item.trim()).filter(Boolean)
      : []

  const lastAdministrationAt = firstString(
    profileRow?.last_administration_at,
    config.last_administration_at,
    config.lastAdministrationAt,
  )

  const monitoringModeRaw = firstString(
    profileRow?.monitoring_mode,
    config.monitoring_mode,
    config.monitoringMode,
  )

  const inferredUsesExogenous = usesExogenousHormones ?? (normalizedType === 'trt' || normalizedType === 'assisted')
  const monitoring_mode: 'natural' | 'assisted' =
    monitoringModeRaw === 'natural' || monitoringModeRaw === 'assisted'
      ? monitoringModeRaw
      : inferredUsesExogenous
        ? 'assisted'
        : 'natural'

  return {
    uses_exogenous_hormones: inferredUsesExogenous,
    hormone_context_type: normalizedType,
    declared_compounds: declaredCompounds,
    last_administration_at: lastAdministrationAt,
    monitoring_mode,
  }
}

export function extractReferenceSelectionContext(profileRow?: GenericRecord | null): {
  sex: 'male' | 'female' | 'other' | 'unknown'
  age: number | null
  hormone: HormoneContextProfile
} {
  const config = profileRow?.config && typeof profileRow.config === 'object'
    ? profileRow.config as GenericRecord
    : {}

  return {
    sex: normalizeSex(firstString(profileRow?.sexo, profileRow?.sex, config.sexo, config.sex)),
    age: extractAge(profileRow ?? {}, config),
    hormone: extractHormoneContextFromProfileRow(profileRow),
  }
}

function splitReferenceText(referenceText: string): string[] {
  return referenceText
    .split(/\s*\|\s*|\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseAgeRange(text: string): { minAge: number | null; maxAge: number | null } {
  const normalized = text.toLowerCase()
  const betweenMatch = normalized.match(/(\d+)\s*a\s*(\d+)\s*anos?/)
  if (betweenMatch) {
    return { minAge: Number(betweenMatch[1]), maxAge: Number(betweenMatch[2]) }
  }

  const upToMatch = normalized.match(/(?:até|inferior a|menor de)\s*(\d+)\s*anos?/)
  if (upToMatch) {
    return { minAge: null, maxAge: Number(upToMatch[1]) }
  }

  const aboveMatch = normalized.match(/(?:acima de|maior(?:es)? de)\s*(\d+)\s*anos?/)
  if (aboveMatch) {
    return { minAge: Number(aboveMatch[1]) + 1, maxAge: null }
  }

  return { minAge: null, maxAge: null }
}

function parseReferenceCandidate(text: string): ReferenceCandidate | null {
  const normalized = text.toLowerCase()
  const numericText = text.includes(':') ? text.slice(text.lastIndexOf(':') + 1).trim() : text
  const sex = normalized.includes('homens') || normalized.includes('masculino')
    ? 'male'
    : normalized.includes('mulheres') || normalized.includes('feminino')
      ? 'female'
      : 'any'
  const ageRange = parseAgeRange(text)
  const mentionsAdult = /\badult[oa]s?\b|\bacima de 18\b|\bacima de 20\b/.test(normalized)

  const rangeMatch = RANGE_RE.exec(numericText)
  if (rangeMatch) {
    return {
      kind: 'range',
      min: toNumber(rangeMatch[1]),
      max: toNumber(rangeMatch[2]),
      rawText: text.trim(),
      sex,
      minAge: ageRange.minAge,
      maxAge: ageRange.maxAge,
      matchedBy: 'generic',
      mentionsAdult,
    }
  }

  const lessMatch = LESS_THAN_RE.exec(numericText)
  if (lessMatch) {
    return {
      kind: 'less_than',
      min: null,
      max: toNumber(lessMatch[1]),
      rawText: text.trim(),
      sex,
      minAge: ageRange.minAge,
      maxAge: ageRange.maxAge,
      matchedBy: 'generic',
      mentionsAdult,
    }
  }

  const greaterMatch = GREATER_THAN_RE.exec(numericText)
  if (greaterMatch) {
    return {
      kind: 'greater_than',
      min: toNumber(greaterMatch[1]),
      max: null,
      rawText: text.trim(),
      sex,
      minAge: ageRange.minAge,
      maxAge: ageRange.maxAge,
      matchedBy: 'generic',
      mentionsAdult,
    }
  }

  return null
}

function normalizeCandidateMatch(candidate: ReferenceCandidate, input: { sex: 'male' | 'female' | 'other' | 'unknown'; age: number | null }): number {
  let score = 0

  if (input.sex === 'male' || input.sex === 'female') {
    if (candidate.sex === input.sex) score += 40
    else if (candidate.sex !== 'any') return Number.NEGATIVE_INFINITY
    else score += 8
  } else if (candidate.sex === 'any') {
    score += 6
  }

  if (input.age != null) {
    if (candidate.minAge != null && input.age < candidate.minAge) return Number.NEGATIVE_INFINITY
    if (candidate.maxAge != null && input.age > candidate.maxAge) return Number.NEGATIVE_INFINITY
    if (candidate.minAge != null || candidate.maxAge != null) score += 20
  }

  if (candidate.mentionsAdult) score += 10
  if (candidate.kind !== 'text') score += 5

  return score
}

function normalizeFlag(value: number | null, min: number | null, max: number | null): BiomarkerEntry['flag'] {
  if (value == null) return null
  if (min != null && value < min) return 'low'
  if (max != null && value > max) return 'high'
  return 'normal'
}

function selectNormalizedReference(
  biomarker: BiomarkerEntry,
  input: { sex: 'male' | 'female' | 'other' | 'unknown'; age: number | null },
): {
  normalizedReference: NormalizedReference | null
  referenceMin: number | null
  referenceMax: number | null
  referenceTextRaw: string | null
  labFlag: BiomarkerEntry['flag']
  sourceReferenceKind: string | null
} {
  const referenceTextRaw = biomarker.reference_text ?? biomarker.reference_text_raw ?? null
  const segments = referenceTextRaw ? splitReferenceText(referenceTextRaw) : []
  const candidates = segments
    .map((segment) => parseReferenceCandidate(segment))
    .filter((candidate): candidate is ReferenceCandidate => Boolean(candidate))

  const hasPhaseSpecificReference = Boolean(referenceTextRaw && PHASE_REFERENCE_RE.test(referenceTextRaw))
  const hasSexSpecificReference = candidates.some((candidate) => candidate.sex !== 'any')
  const hasAgeSpecificReference = candidates.some((candidate) => candidate.minAge != null || candidate.maxAge != null)

  if (
    referenceTextRaw
    && (
      hasPhaseSpecificReference
      || (hasSexSpecificReference && input.sex !== 'male' && input.sex !== 'female')
      || (hasAgeSpecificReference && input.age == null)
    )
  ) {
    return {
      normalizedReference: {
        kind: 'text',
        min: null,
        max: null,
        raw_text: referenceTextRaw,
        matched_by: 'ambiguous',
        sex: 'any',
        min_age: null,
        max_age: null,
      },
      referenceMin: null,
      referenceMax: null,
      referenceTextRaw,
      labFlag: biomarker.flag ?? biomarker.lab_flag ?? null,
      sourceReferenceKind: 'ambiguous',
    }
  }

  let selected: ReferenceCandidate | null = null
  let selectedScore = Number.NEGATIVE_INFINITY
  let selectedCount = 0
  for (const candidate of candidates) {
    const score = normalizeCandidateMatch(candidate, input)
    if (score > selectedScore) {
      selected = candidate
      selectedScore = score
      selectedCount = 1
    } else if (score === selectedScore && score !== Number.NEGATIVE_INFINITY) {
      selectedCount += 1
    }
  }

  if (referenceTextRaw && selected && selectedCount > 1) {
    return {
      normalizedReference: {
        kind: 'text',
        min: null,
        max: null,
        raw_text: referenceTextRaw,
        matched_by: 'ambiguous',
        sex: 'any',
        min_age: null,
        max_age: null,
      },
      referenceMin: null,
      referenceMax: null,
      referenceTextRaw,
      labFlag: biomarker.flag ?? biomarker.lab_flag ?? null,
      sourceReferenceKind: 'ambiguous',
    }
  }

  if (!selected && biomarker.reference_min == null && biomarker.reference_max == null && referenceTextRaw) {
    return {
      normalizedReference: {
        kind: 'text',
        min: null,
        max: null,
        raw_text: referenceTextRaw,
        matched_by: 'text_only',
        sex: 'any',
        min_age: null,
        max_age: null,
      },
      referenceMin: null,
      referenceMax: null,
      referenceTextRaw,
      labFlag: biomarker.flag ?? null,
      sourceReferenceKind: 'text_only',
    }
  }

  if (!selected) {
    const labFlag = biomarker.lab_flag ?? biomarker.flag ?? normalizeFlag(biomarker.value_numeric, biomarker.reference_min, biomarker.reference_max)
    if (biomarker.reference_min == null && biomarker.reference_max == null) {
      return {
        normalizedReference: null,
        referenceMin: biomarker.reference_min,
        referenceMax: biomarker.reference_max,
        referenceTextRaw,
        labFlag,
        sourceReferenceKind: null,
      }
    }

    return {
      normalizedReference: {
        kind: biomarker.reference_min != null && biomarker.reference_max != null
          ? 'range'
          : biomarker.reference_max != null
            ? 'less_than'
            : 'greater_than',
        min: biomarker.reference_min,
        max: biomarker.reference_max,
        raw_text: referenceTextRaw ?? '',
        matched_by: 'ocr_numeric',
        sex: 'any',
        min_age: null,
        max_age: null,
      },
      referenceMin: biomarker.reference_min,
      referenceMax: biomarker.reference_max,
      referenceTextRaw,
      labFlag,
      sourceReferenceKind: 'ocr_numeric',
    }
  }

  const matchedBy: NormalizedReference['matched_by'] =
    selected.sex !== 'any' && (selected.minAge != null || selected.maxAge != null)
      ? 'sex_age'
      : selected.sex !== 'any'
        ? 'sex'
        : selected.minAge != null || selected.maxAge != null
          ? 'age'
          : selected.mentionsAdult
            ? 'adult'
            : 'generic'

  const referenceMin = selected.min
  const referenceMax = selected.max
  const labFlag = normalizeFlag(biomarker.value_numeric, referenceMin, referenceMax)

  return {
    normalizedReference: {
      kind: selected.kind,
      min: referenceMin,
      max: referenceMax,
      raw_text: selected.rawText,
      matched_by: matchedBy,
      sex: selected.sex,
      min_age: selected.minAge,
      max_age: selected.maxAge,
    },
    referenceMin,
    referenceMax,
    referenceTextRaw,
    labFlag,
    sourceReferenceKind: matchedBy,
  }
}

function defaultMonitorPriority(entry: BiomarkerEntry): 'low' | 'medium' | 'high' {
  const labFlag = entry.lab_flag ?? entry.flag
  if (entry.safety_relevance && labFlag && labFlag !== 'normal') return 'high'
  if ((HORMONE_MARKERS.has(entry.marker_key) || entry.safety_relevance) && labFlag && labFlag !== 'normal') return 'medium'
  return 'low'
}

function hormoneContextSummary(hormone: HormoneContextProfile): string {
  switch (hormone.hormone_context_type) {
    case 'natural':
      return 'contexto natural declarado'
    case 'trt':
      return 'TRT declarada'
    case 'assisted':
      return 'uso hormonal assistido declarado'
    default:
      return 'contexto hormonal não declarado'
  }
}

function buildContextFlag(entry: BiomarkerEntry, hormone: HormoneContextProfile): string | null {
  const labFlag = entry.lab_flag ?? entry.flag
  if (!labFlag || labFlag === 'normal') return null

  if (entry.marker_key === 'testosterone_total' || entry.marker_key === 'testosterone_free') {
    if (labFlag === 'high') {
      if (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted') {
        return 'compatible_with_declared_exogenous_testosterone_use'
      }
      if (hormone.hormone_context_type === 'natural') {
        return 'unexpected_for_declared_natural_context'
      }
    }
    if (labFlag === 'low' && (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted')) {
      return 'lower_than_expected_even_with_declared_hormone_context'
    }
  }

  if (entry.marker_key === 'lh' || entry.marker_key === 'fsh') {
    if (labFlag === 'low') {
      if (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted') {
        return 'expected_axis_suppression_under_declared_testosterone_use'
      }
      return 'clinically_relevant_without_declared_hormone_context'
    }
  }

  if (entry.marker_key === 'shbg') {
    if (labFlag === 'low' && (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted')) {
      return 'compatible_with_androgen_exposure_but_requires_monitoring'
    }
    return 'clinically_relevant_in_current_hormone_context'
  }

  if (entry.marker_key === 'estradiol') {
    if (labFlag === 'high' && (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted')) {
      return 'elevated_even_with_declared_testosterone_use'
    }
    if (labFlag === 'high') return 'elevated_for_declared_context'
  }

  if (entry.marker_key === 'dht' && labFlag === 'high' && (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted')) {
    return 'compatible_with_declared_androgen_exposure_but_requires_monitoring'
  }

  if (entry.marker_key === 'prolactin') {
    return 'requires_clinical_correlation_in_current_context'
  }

  if (SAFETY_MARKERS.has(entry.marker_key)) {
    if (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted') {
      return 'clinically_relevant_even_with_declared_hormone_context'
    }
    return 'clinically_relevant'
  }

  return null
}

function buildFeedbackSummary(entry: BiomarkerEntry, hormone: HormoneContextProfile): string | null {
  const labFlag = entry.lab_flag ?? entry.flag
  if (!labFlag) return null

  const markerName = entry.marker_name || entry.marker_key
  const referenceClause = entry.reference_text_raw || entry.reference_text

  if (entry.marker_key === 'testosterone_total' || entry.marker_key === 'testosterone_free') {
    if (labFlag === 'high') {
      if (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted') {
        return `${markerName} acima da faixa laboratorial. Em ${hormoneContextSummary(hormone)}, o achado pode ser compatível com a intervenção; correlacionar com estradiol, SHBG, hematócrito, HDL e PSA.`
      }
      return `${markerName} acima da faixa laboratorial, achado pouco esperado em ${hormoneContextSummary(hormone)}. Correlacionar com SHBG, estradiol e contexto clínico-esportivo.`
    }
    if (labFlag === 'low') {
      return `${markerName} abaixo da faixa laboratorial. Correlacionar com sintomas, SHBG, LH/FSH e contexto hormonal declarado.`
    }
  }

  if (entry.marker_key === 'lh' || entry.marker_key === 'fsh') {
    if (labFlag === 'low' && (hormone.hormone_context_type === 'trt' || hormone.hormone_context_type === 'assisted')) {
      return `${markerName} baixo no laudo e compatível com supressão do eixo em ${hormoneContextSummary(hormone)}. Em usuário natural, o peso interpretativo seria diferente.`
    }
    if (labFlag === 'low') {
      return `${markerName} baixo para a faixa laboratorial. Sem uso hormonal declarado, o achado merece correlação clínica e avaliação do eixo.`
    }
  }

  if (entry.marker_key === 'vitamin_d' && labFlag === 'normal' && entry.value_numeric != null && entry.value_numeric < 30) {
    return `${markerName} dentro da faixa laboratorial${referenceClause ? ` (${referenceClause})` : ''}. Pode caber observação secundária sobre alvo funcional mais alto em alguns atletas, sem reclassificar como deficiência.`
  }

  if (SAFETY_MARKERS.has(entry.marker_key) && labFlag !== 'normal') {
    return `${markerName} ${labFlag === 'high' ? 'acima' : 'abaixo'} da faixa laboratorial e segue clinicamente relevante mesmo em contexto assistido.`
  }

  if (labFlag === 'normal') {
    return `${markerName} dentro da faixa laboratorial selecionada.`
  }

  return `${markerName} ${labFlag === 'high' ? 'acima' : 'abaixo'} da faixa laboratorial${referenceClause ? ` (${referenceClause})` : ''}.`
}

export function enrichBiomarkerEntries(
  biomarkers: BiomarkerEntry[],
  profileRow?: GenericRecord | null,
): BiomarkerEntry[] {
  const context = extractReferenceSelectionContext(profileRow)

  return biomarkers.map((entry) => {
    const selectedReference = selectNormalizedReference(entry, context)
    const lab_flag = selectedReference.labFlag
    const safety_relevance = SAFETY_MARKERS.has(entry.marker_key)
    const interpretation_mode = context.hormone.hormone_context_type
    const context_flag = buildContextFlag({
      ...entry,
      reference_min: selectedReference.referenceMin,
      reference_max: selectedReference.referenceMax,
      reference_text_raw: selectedReference.referenceTextRaw,
      normalized_reference: selectedReference.normalizedReference,
      lab_flag,
      flag: lab_flag,
      safety_relevance,
      interpretation_mode,
    }, context.hormone)

    const enriched: BiomarkerEntry = {
      ...entry,
      reference_min: selectedReference.referenceMin,
      reference_max: selectedReference.referenceMax,
      reference_text_raw: selectedReference.referenceTextRaw,
      normalized_reference: selectedReference.normalizedReference,
      lab_flag,
      flag: lab_flag,
      context_flag,
      interpretation_mode,
      safety_relevance,
      monitor_priority: null,
      feedback_summary: null,
      source_reference_kind: selectedReference.sourceReferenceKind,
    }

    enriched.monitor_priority = defaultMonitorPriority(enriched)
    enriched.feedback_summary = buildFeedbackSummary(enriched, context.hormone)
    return enriched
  })
}

export function summarizeMarkerInterpretations(biomarkers: BiomarkerEntry[]): string | null {
  const relevant = biomarkers
    .filter((item) => {
      const labFlag = item.lab_flag ?? item.flag
      return (labFlag && labFlag !== 'normal') || Boolean(item.context_flag)
    })
    .sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 }
      return (priorityScore[b.monitor_priority ?? 'low'] ?? 0) - (priorityScore[a.monitor_priority ?? 'low'] ?? 0)
    })
    .slice(0, 6)

  if (!relevant.length) return null
  return relevant
    .map((item) => item.feedback_summary || `${item.marker_name}: ${item.lab_flag ?? item.flag ?? 'sem classificação'}.`)
    .join(' ')
}
