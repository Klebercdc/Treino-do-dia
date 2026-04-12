// ---------------------------------------------------------------------------
// Core biomarker entry — canonical shape persisted in normalized_payload
// ---------------------------------------------------------------------------
export interface BiomarkerEntry {
  marker_key: string
  marker_name: string
  value_numeric: number | null
  value_text: string | null
  unit: string | null
  reference_min: number | null
  reference_max: number | null
  reference_text: string | null
  flag: 'low' | 'high' | 'normal' | null
  source_line: string | null
  confidence: number | null
  reference_text_raw?: string | null
  normalized_reference?: NormalizedReference | null
  lab_flag?: 'low' | 'high' | 'normal' | null
  context_flag?: string | null
  interpretation_mode?: HormoneContextType | null
  monitor_priority?: 'low' | 'medium' | 'high' | null
  safety_relevance?: boolean | null
  feedback_summary?: string | null
  source_reference_kind?: string | null
}

export type HormoneContextType = 'natural' | 'trt' | 'assisted' | 'unknown'

export interface HormoneContextProfile {
  uses_exogenous_hormones: boolean
  hormone_context_type: HormoneContextType
  declared_compounds: string[]
  last_administration_at: string | null
  monitoring_mode: 'natural' | 'assisted'
}

export interface NormalizedReference {
  kind: 'range' | 'less_than' | 'greater_than' | 'text'
  min: number | null
  max: number | null
  raw_text: string
  matched_by: 'sex_age' | 'sex' | 'age' | 'adult' | 'generic' | 'ocr_numeric' | 'text_only' | 'ambiguous'
  sex: 'male' | 'female' | 'any'
  min_age: number | null
  max_age: number | null
}

// ---------------------------------------------------------------------------
// Legacy parsed report — still used by labValidator and labRules for
// backwards compatibility. Kept intentionally narrow.
// ---------------------------------------------------------------------------
export interface ParsedLabReport {
  // Metabolic
  glucose: number | null
  hba1c: number | null
  insulin: number | null
  // Lipids
  cholesterol_total: number | null
  hdl: number | null
  ldl: number | null
  vldl: number | null
  triglycerides: number | null
  // Liver
  ast: number | null
  alt: number | null
  ggt: number | null
  // Kidney
  creatinine: number | null
  urea: number | null
  uric_acid: number | null
  egfr: number | null
  // Electrolytes
  potassium: number | null
  sodium: number | null
  magnesium: number | null
  calcium: number | null
  // Hematologic
  hemoglobin: number | null
  hematocrit: number | null
  ferritin: number | null
  // Thyroid
  tsh: number | null
  t4_free: number | null
  // Hormonal
  testosterone_total: number | null
  testosterone_free: number | null
  lh: number | null
  fsh: number | null
  shbg: number | null
  estradiol: number | null
  dht: number | null
  prolactin: number | null
  cortisol: number | null
  dhea_s: number | null
  // Inflammation
  crp: number | null
  homocysteine: number | null
  // Micronutrients
  vitamin_d: number | null
  vitamin_b12: number | null
  folate: number | null
  zinc: number | null
  // PSA
  psa_total: number | null
  psa_free: number | null
}

// ---------------------------------------------------------------------------
// Signal severity
// ---------------------------------------------------------------------------
export type SignalLevel = 'ok' | 'attention' | 'caution' | 'critical'

export interface SignalGroup {
  level: SignalLevel
  flags: string[]
  notes: string[]
}

// ---------------------------------------------------------------------------
// Health & performance profile — structured product signals derived from
// biomarkers for use in training/diet/supplement personalization.
// This is fully deterministic, conservative, NOT a medical diagnosis.
// ---------------------------------------------------------------------------
export interface HealthPerformanceProfile {
  /** Metabolic: glucose, hba1c, insulin, homa_ir */
  metabolic_health: SignalGroup
  /** Lipid panel: cholesterol, HDL, LDL, triglycerides */
  lipid_health: SignalGroup
  /** Liver enzymes: AST, ALT, GGT, alkaline phosphatase, bilirubin */
  liver_health: SignalGroup
  /** Kidney & hydration: creatinine, urea, eGFR, electrolytes */
  kidney_hydration: SignalGroup
  /** Blood count & iron: hemoglobin, ferritin, vitamin B12, folate */
  hematologic_status: SignalGroup
  /** Thyroid: TSH, T4L, T3L */
  thyroid_status: SignalGroup
  /** Androgens & sex hormones: testosterone, SHBG, estradiol, cortisol, DHEA-S */
  androgen_status: SignalGroup
  /** Inflammation & CV risk: CRP, homocysteine */
  inflammation_status: SignalGroup
  /** Micronutrients: vitamin D, B12, folate, zinc, selenium */
  micronutrient_status: SignalGroup
  /** Composite: readiness for high-intensity training */
  training_readiness: SignalGroup
  /** Composite: risk of impaired recovery */
  recovery_risk: SignalGroup
  /** Diet attention points derived from biomarkers */
  dietary_attention_points: SignalGroup
  /** Safety flags requiring caution or professional evaluation */
  safety_flags: SignalGroup
  /** Numeric scores 0–100 for AI context */
  scores: {
    metabolic_score: number
    recovery_score: number
    hematologic_score: number
    hormonal_score: number
    safety_score: number
    lipid_score: number
    liver_score: number
    kidney_score: number
  }
}

// ---------------------------------------------------------------------------
// Validated report (wraps parsed + confidence)
// ---------------------------------------------------------------------------
export interface ValidatedLabReport {
  parsed: ParsedLabReport
  confidence: number
  isValid: boolean
  validationErrors: string[]
}

// ---------------------------------------------------------------------------
// Clinical rule result
// ---------------------------------------------------------------------------
export interface ClinicalRuleResult {
  mode: 'standard' | 'clinical'
  clinicalFlags: string[]
  criticalFlags: string[]
}

// ---------------------------------------------------------------------------
// Stored lab context (used in AI context bundles)
// ---------------------------------------------------------------------------
export interface StoredLabContext {
  id: string
  createdAt: string | null
  confidence: number
  mode: 'standard' | 'clinical'
  parsed: ParsedLabReport | null
  isValid: boolean
  clinicalFlags: string[]
  criticalFlags: string[]
  healthProfile?: HealthPerformanceProfile | null
  markerInterpretations?: BiomarkerEntry[]
  interpretationSummary?: string | null
  hormoneContext?: HormoneContextProfile | null
}

export type LabMarkerTrendStatus =
  | 'improved'
  | 'worsened'
  | 'stable'
  | 'persistent_abnormal'
  | 'new_alert'
  | 'insufficient_data'

export interface LabBiomarkerTrendPoint {
  reportId: string
  createdAt: string | null
  valueNumeric: number | null
  valueText: string | null
  unit: string | null
  flag: 'low' | 'high' | 'normal' | null
}

export interface LabBiomarkerTrend {
  markerKey: string
  markerName: string
  unit: string | null
  status: LabMarkerTrendStatus
  latestReportId: string
  latestCreatedAt: string | null
  latestValueNumeric: number | null
  latestValueText: string | null
  latestFlag: 'low' | 'high' | 'normal' | null
  previousReportId: string | null
  previousCreatedAt: string | null
  previousValueNumeric: number | null
  previousValueText: string | null
  previousFlag: 'low' | 'high' | 'normal' | null
  abnormalCount: number
  totalPoints: number
  points: LabBiomarkerTrendPoint[]
}

export interface LabLongitudinalSignals {
  recovery: string | null
  trainingReadiness: string | null
  metabolicRisk: string | null
  hormonalTrend: string | null
  clinicalPersistence: string | null
}

export interface LabLongitudinalContext {
  totalReports: number
  latestReportId: string | null
  latestReportDate: string | null
  previousReportId: string | null
  previousReportDate: string | null
  latestClinicalFlags: string[]
  latestCriticalFlags: string[]
  markerTimeline: LabBiomarkerTrend[]
  worseningMarkers: string[]
  improvingMarkers: string[]
  stableMarkers: string[]
  persistentAbnormalMarkers: string[]
  newAlertMarkers: string[]
  signals: LabLongitudinalSignals
  summaryText: string | null
}
