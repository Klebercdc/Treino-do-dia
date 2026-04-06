import type { ParsedLabReport, ValidatedLabReport } from "./labTypes"

const FIELD_NAMES: Array<keyof ParsedLabReport> = [
  "glucose",
  "hba1c",
  "creatinine",
  "potassium",
  "sodium",
  "cholesterol_total",
  "hdl",
  "ldl",
  "triglycerides",
]

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeParsedLabReport(value: unknown): ParsedLabReport {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    glucose: normalizeNumber(source.glucose),
    hba1c: normalizeNumber(source.hba1c),
    creatinine: normalizeNumber(source.creatinine),
    potassium: normalizeNumber(source.potassium),
    sodium: normalizeNumber(source.sodium),
    cholesterol_total: normalizeNumber(source.cholesterol_total),
    hdl: normalizeNumber(source.hdl),
    ldl: normalizeNumber(source.ldl),
    triglycerides: normalizeNumber(source.triglycerides),
  }
}

export function computeLabConfidence(parsed: ParsedLabReport): number {
  const present = FIELD_NAMES.reduce((acc, key) => acc + (typeof parsed[key] === "number" ? 1 : 0), 0)
  return Math.round((present / FIELD_NAMES.length) * 100) / 100
}

export function validateLabReport(value: unknown): ValidatedLabReport {
  const parsed = normalizeParsedLabReport(value)
  const validationErrors: string[] = []

  if (parsed.glucose !== null && (parsed.glucose < 0 || parsed.glucose >= 500)) {
    validationErrors.push("glucose_out_of_range")
  }
  if (parsed.hba1c !== null && (parsed.hba1c < 0 || parsed.hba1c > 20)) {
    validationErrors.push("hba1c_out_of_range")
  }
  if (parsed.creatinine !== null && (parsed.creatinine < 0 || parsed.creatinine >= 20)) {
    validationErrors.push("creatinine_out_of_range")
  }
  if (parsed.potassium !== null && (parsed.potassium < 0 || parsed.potassium >= 10)) {
    validationErrors.push("potassium_out_of_range")
  }
  if (parsed.sodium !== null && (parsed.sodium < 0 || parsed.sodium > 250)) {
    validationErrors.push("sodium_out_of_range")
  }
  if (parsed.cholesterol_total !== null && parsed.cholesterol_total < 0) {
    validationErrors.push("cholesterol_total_out_of_range")
  }
  if (parsed.hdl !== null && parsed.hdl < 0) {
    validationErrors.push("hdl_out_of_range")
  }
  if (parsed.ldl !== null && parsed.ldl < 0) {
    validationErrors.push("ldl_out_of_range")
  }
  if (parsed.triglycerides !== null && parsed.triglycerides < 0) {
    validationErrors.push("triglycerides_out_of_range")
  }
  if (
    parsed.cholesterol_total !== null &&
    parsed.hdl !== null &&
    parsed.cholesterol_total < parsed.hdl
  ) {
    validationErrors.push("hdl_gt_total_cholesterol")
  }

  return {
    parsed,
    confidence: computeLabConfidence(parsed),
    isValid: validationErrors.length === 0,
    validationErrors,
  }
}
