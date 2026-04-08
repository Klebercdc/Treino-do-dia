import type { ClinicalRuleResult, ParsedLabReport } from "./labTypes"

function hasValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function resolveDietMode(labReport?: { is_valid?: boolean | null; parsed?: ParsedLabReport | null } | null): "standard" | "clinical" {
  if (!labReport || !labReport.is_valid || !labReport.parsed) return "standard"
  return "clinical"
}

export function applyClinicalRules(parsed?: ParsedLabReport | null): ClinicalRuleResult {
  if (!parsed) {
    return { mode: "standard", clinicalFlags: [], criticalFlags: [] }
  }

  const clinicalFlags = new Set<string>()
  const criticalFlags = new Set<string>()

  if (hasValue(parsed.glucose) && parsed.glucose > 100) clinicalFlags.add("pre_diabetes")
  if (hasValue(parsed.hba1c) && parsed.hba1c > 5.7) clinicalFlags.add("glycemic_risk")
  if (hasValue(parsed.potassium) && parsed.potassium > 5) clinicalFlags.add("high_potassium")
  if (hasValue(parsed.ldl) && parsed.ldl > 130) clinicalFlags.add("high_ldl")

  if (hasValue(parsed.glucose) && parsed.glucose >= 126) criticalFlags.add("hyperglycemia_alert")
  if (hasValue(parsed.hba1c) && parsed.hba1c >= 6.5) criticalFlags.add("hba1c_alert")
  if (hasValue(parsed.potassium) && parsed.potassium >= 5.5) criticalFlags.add("potassium_alert")
  if (hasValue(parsed.creatinine) && parsed.creatinine >= 2) criticalFlags.add("kidney_alert")
  if (hasValue(parsed.ldl) && parsed.ldl >= 160) criticalFlags.add("ldl_alert")

  const mode = clinicalFlags.size > 0 || criticalFlags.size > 0 ? "clinical" : "standard"
  return {
    mode,
    clinicalFlags: Array.from(clinicalFlags),
    criticalFlags: Array.from(criticalFlags),
  }
}
