export interface ParsedLabReport {
  glucose: number | null
  hba1c: number | null
  creatinine: number | null
  potassium: number | null
  sodium: number | null
  cholesterol_total: number | null
  hdl: number | null
  ldl: number | null
  triglycerides: number | null
}

export interface ValidatedLabReport {
  parsed: ParsedLabReport
  confidence: number
  isValid: boolean
  validationErrors: string[]
}

export interface ClinicalRuleResult {
  mode: "standard" | "clinical"
  clinicalFlags: string[]
  criticalFlags: string[]
}

export interface StoredLabContext {
  id: string
  createdAt: string | null
  confidence: number
  mode: "standard" | "clinical"
  parsed: ParsedLabReport | null
  isValid: boolean
  clinicalFlags: string[]
  criticalFlags: string[]
}
