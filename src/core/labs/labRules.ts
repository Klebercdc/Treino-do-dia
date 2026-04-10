import type { BiomarkerEntry, ClinicalRuleResult, HealthPerformanceProfile, ParsedLabReport } from './labTypes'
import { buildHealthPerformanceProfile } from './labHealthProfile'

function hasValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function resolveDietMode(
  labReport?: { is_valid?: boolean | null; parsed?: ParsedLabReport | null } | null,
): 'standard' | 'clinical' {
  if (!labReport || !labReport.is_valid || !labReport.parsed) return 'standard'
  return 'clinical'
}

/**
 * Apply conservative clinical rules from the legacy ParsedLabReport shape.
 * Expanded to cover all key marker groups.
 */
export function applyClinicalRules(parsed?: ParsedLabReport | null): ClinicalRuleResult {
  if (!parsed) {
    return { mode: 'standard', clinicalFlags: [], criticalFlags: [] }
  }

  const clinicalFlags = new Set<string>()
  const criticalFlags = new Set<string>()

  // Metabolic
  if (hasValue(parsed.glucose) && parsed.glucose > 100) clinicalFlags.add('pre_diabetes')
  if (hasValue(parsed.hba1c) && parsed.hba1c > 5.7) clinicalFlags.add('glycemic_risk')
  if (hasValue(parsed.insulin) && parsed.insulin > 15) clinicalFlags.add('high_insulin')

  if (hasValue(parsed.glucose) && parsed.glucose >= 126) criticalFlags.add('hyperglycemia_alert')
  if (hasValue(parsed.hba1c) && parsed.hba1c >= 6.5) criticalFlags.add('hba1c_alert')

  // Lipids
  if (hasValue(parsed.ldl) && parsed.ldl > 130) clinicalFlags.add('high_ldl')
  if (hasValue(parsed.triglycerides) && parsed.triglycerides > 150) clinicalFlags.add('high_triglycerides')
  if (hasValue(parsed.hdl) && parsed.hdl < 40) clinicalFlags.add('low_hdl')

  if (hasValue(parsed.ldl) && parsed.ldl >= 160) criticalFlags.add('ldl_alert')
  if (hasValue(parsed.triglycerides) && parsed.triglycerides >= 500) criticalFlags.add('triglycerides_critical')

  // Liver
  if (hasValue(parsed.ast) && parsed.ast > 40) clinicalFlags.add('ast_elevated')
  if (hasValue(parsed.alt) && parsed.alt > 40) clinicalFlags.add('alt_elevated')
  if (hasValue(parsed.ggt) && parsed.ggt > 50) clinicalFlags.add('ggt_elevated')

  if (hasValue(parsed.ast) && parsed.ast > 120) criticalFlags.add('ast_critical')
  if (hasValue(parsed.alt) && parsed.alt > 120) criticalFlags.add('alt_critical')

  // Kidney
  if (hasValue(parsed.creatinine) && parsed.creatinine >= 1.3) clinicalFlags.add('creatinine_borderline')
  if (hasValue(parsed.potassium) && parsed.potassium > 5) clinicalFlags.add('high_potassium')
  if (hasValue(parsed.uric_acid) && parsed.uric_acid > 6.5) clinicalFlags.add('high_uric_acid')

  if (hasValue(parsed.creatinine) && parsed.creatinine >= 2) criticalFlags.add('kidney_alert')
  if (hasValue(parsed.potassium) && parsed.potassium >= 5.5) criticalFlags.add('potassium_alert')
  if (hasValue(parsed.egfr) && parsed.egfr < 60) criticalFlags.add('egfr_reduced')

  // Hematologic
  if (hasValue(parsed.hemoglobin) && parsed.hemoglobin < 12.5) clinicalFlags.add('low_hemoglobin')
  if (hasValue(parsed.ferritin) && parsed.ferritin < 30) clinicalFlags.add('low_ferritin')
  if (hasValue(parsed.vitamin_b12) && parsed.vitamin_b12 < 300) clinicalFlags.add('low_b12')
  if (hasValue(parsed.folate) && parsed.folate < 3) clinicalFlags.add('low_folate')

  if (hasValue(parsed.hemoglobin) && parsed.hemoglobin < 8) criticalFlags.add('hemoglobin_critical')

  // Thyroid
  if (hasValue(parsed.tsh) && parsed.tsh > 4.5) clinicalFlags.add('tsh_elevated')
  if (hasValue(parsed.tsh) && parsed.tsh < 0.4) clinicalFlags.add('tsh_low')

  if (hasValue(parsed.tsh) && parsed.tsh > 10) criticalFlags.add('tsh_critical')

  // Hormonal
  if (hasValue(parsed.testosterone_total) && parsed.testosterone_total < 350) clinicalFlags.add('low_testosterone')
  if (hasValue(parsed.cortisol) && parsed.cortisol > 25) clinicalFlags.add('high_cortisol')

  // Inflammation
  if (hasValue(parsed.crp) && parsed.crp >= 1) clinicalFlags.add('crp_elevated')
  if (hasValue(parsed.homocysteine) && parsed.homocysteine > 12) clinicalFlags.add('high_homocysteine')

  if (hasValue(parsed.crp) && parsed.crp >= 10) criticalFlags.add('crp_critical')

  // Micronutrients
  if (hasValue(parsed.vitamin_d) && parsed.vitamin_d < 30) clinicalFlags.add('low_vitamin_d')
  if (hasValue(parsed.zinc) && parsed.zinc < 65) clinicalFlags.add('low_zinc')

  const mode = clinicalFlags.size > 0 || criticalFlags.size > 0 ? 'clinical' : 'standard'
  return {
    mode,
    clinicalFlags: Array.from(clinicalFlags),
    criticalFlags: Array.from(criticalFlags),
  }
}

/**
 * Build health & performance profile from normalized biomarker entries.
 * Re-exports buildHealthPerformanceProfile for convenience.
 */
export { buildHealthPerformanceProfile }

/**
 * Build ParsedLabReport from a list of normalized BiomarkerEntry objects.
 * Provides backwards compatibility with legacy code expecting ParsedLabReport.
 */
export function parsedFromBiomarkers(biomarkers: BiomarkerEntry[]): ParsedLabReport {
  const byKey = new Map<string, number | null>()
  for (const b of biomarkers) {
    if (b.marker_key && b.value_numeric !== undefined) {
      byKey.set(b.marker_key, b.value_numeric)
    }
  }

  function get(key: string): number | null {
    return byKey.get(key) ?? null
  }

  return {
    glucose: get('glucose'),
    hba1c: get('hba1c'),
    insulin: get('insulin'),
    cholesterol_total: get('total_cholesterol'),
    hdl: get('hdl_cholesterol'),
    ldl: get('ldl_cholesterol'),
    vldl: get('vldl_cholesterol'),
    triglycerides: get('triglycerides'),
    ast: get('ast'),
    alt: get('alt'),
    ggt: get('ggt'),
    creatinine: get('creatinine'),
    urea: get('urea'),
    uric_acid: get('uric_acid'),
    egfr: get('egfr'),
    potassium: get('potassium'),
    sodium: get('sodium'),
    magnesium: get('magnesium'),
    calcium: get('calcium'),
    hemoglobin: get('hemoglobin'),
    hematocrit: get('hematocrit'),
    ferritin: get('ferritin'),
    tsh: get('tsh'),
    t4_free: get('t4_free'),
    testosterone_total: get('testosterone_total'),
    testosterone_free: get('testosterone_free'),
    shbg: get('shbg'),
    estradiol: get('estradiol'),
    cortisol: get('cortisol'),
    dhea_s: get('dhea_s'),
    crp: get('crp'),
    homocysteine: get('homocysteine'),
    vitamin_d: get('vitamin_d'),
    vitamin_b12: get('vitamin_b12'),
    folate: get('folate'),
    zinc: get('zinc'),
    psa_total: get('psa_total'),
    psa_free: get('psa_free'),
  }
}

/**
 * Derive clinical flags directly from a BiomarkerEntry list.
 * Builds ParsedLabReport then applies clinical rules.
 */
export function applyClinicalRulesFromBiomarkers(biomarkers: BiomarkerEntry[]): ClinicalRuleResult {
  const parsed = parsedFromBiomarkers(biomarkers)
  return applyClinicalRules(parsed)
}

/**
 * Summarize a HealthPerformanceProfile as a human-readable string
 * suitable for injection into an AI context bundle.
 */
export function serializeHealthProfile(profile: HealthPerformanceProfile): string {
  const lines: string[] = []

  function serializeGroup(label: string, group: { level: string; flags: string[]; notes: string[] }) {
    const status = group.level === 'ok' ? 'OK' : group.level.toUpperCase()
    lines.push(`${label}: ${status}`)
    if (group.notes.length > 0) {
      for (const note of group.notes.slice(0, 3)) {
        lines.push(`  • ${note}`)
      }
    }
  }

  lines.push('=== PERFIL DE SAÚDE (derivado de exames) ===')
  serializeGroup('Saúde metabólica', profile.metabolic_health)
  serializeGroup('Perfil lipídico', profile.lipid_health)
  serializeGroup('Função hepática', profile.liver_health)
  serializeGroup('Função renal / hidratação', profile.kidney_hydration)
  serializeGroup('Status hematológico', profile.hematologic_status)
  serializeGroup('Tireoide', profile.thyroid_status)
  serializeGroup('Status androgênico / hormonal', profile.androgen_status)
  serializeGroup('Inflamação', profile.inflammation_status)
  serializeGroup('Micronutrientes', profile.micronutrient_status)
  lines.push('')
  serializeGroup('Prontidão para treino', profile.training_readiness)
  serializeGroup('Risco de recuperação', profile.recovery_risk)
  serializeGroup('Atenções alimentares', profile.dietary_attention_points)

  if (profile.safety_flags.level !== 'ok') {
    lines.push('')
    lines.push('⚠ SINAIS DE SEGURANÇA:')
    for (const note of profile.safety_flags.notes.slice(0, 5)) {
      lines.push(`  ! ${note}`)
    }
  }

  lines.push('')
  lines.push(
    `Scores: metabólico=${profile.scores.metabolic_score} | recuperação=${profile.scores.recovery_score} | ` +
    `hematológico=${profile.scores.hematologic_score} | hormonal=${profile.scores.hormonal_score} | ` +
    `segurança=${profile.scores.safety_score} | lipídios=${profile.scores.lipid_score} | ` +
    `fígado=${profile.scores.liver_score} | rim=${profile.scores.kidney_score}`,
  )

  return lines.join('\n')
}
