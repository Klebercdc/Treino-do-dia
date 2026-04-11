/**
 * Unit tests for the labHealthProfile interpreter and expanded labRules.
 *
 * Coverage:
 * - buildHealthPerformanceProfile signal groups
 * - Critical / caution / attention thresholds
 * - Score computation
 * - parsedFromBiomarkers backwards-compatibility bridge
 * - applyClinicalRulesFromBiomarkers expanded coverage
 * - serializeHealthProfile output format
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { BiomarkerEntry } from '../../src/core/labs/labTypes'
import { buildHealthPerformanceProfile } from '../../src/core/labs/labHealthProfile'
import {
  applyClinicalRulesFromBiomarkers,
  parsedFromBiomarkers,
  serializeHealthProfile,
} from '../../src/core/labs/labRules'

function expect(value: unknown) {
  return {
    toBe(expected: unknown) {
      assert.equal(value, expected)
    },
    toEqual(expected: unknown) {
      assert.deepEqual(value, expected)
    },
    toContain(expected: unknown) {
      assert.ok(
        (Array.isArray(value) || typeof value === 'string') && value.includes(expected as never),
        `Expected value to contain ${String(expected)}`,
      )
    },
    toHaveLength(expected: number) {
      assert.equal((value as { length: number } | null | undefined)?.length, expected)
    },
    toBeNull() {
      assert.equal(value, null)
    },
    toBeGreaterThan(expected: number) {
      assert.ok(typeof value === 'number' && value > expected)
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok(typeof value === 'number' && value >= expected)
    },
    toBeLessThan(expected: number) {
      assert.ok(typeof value === 'number' && value < expected)
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok(typeof value === 'number' && value <= expected)
    },
    get not() {
      return {
        toContain(expected: unknown) {
          assert.ok(
            !((Array.isArray(value) || typeof value === 'string') && value.includes(expected as never)),
            `Expected value not to contain ${String(expected)}`,
          )
        },
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function bm(
  key: string,
  value: number,
  extras: Partial<BiomarkerEntry> = {},
): BiomarkerEntry {
  return {
    marker_key: key,
    marker_name: key,
    value_numeric: value,
    value_text: String(value),
    unit: null,
    reference_min: null,
    reference_max: null,
    reference_text: null,
    flag: null,
    source_line: null,
    confidence: 0.9,
    ...extras,
  }
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — empty input', () => {
  it('returns all ok groups with no flags when no biomarkers provided', () => {
    const profile = buildHealthPerformanceProfile([])
    expect(profile.metabolic_health.level).toBe('ok')
    expect(profile.lipid_health.level).toBe('ok')
    expect(profile.liver_health.level).toBe('ok')
    expect(profile.kidney_hydration.level).toBe('ok')
    expect(profile.hematologic_status.level).toBe('ok')
    expect(profile.thyroid_status.level).toBe('ok')
    expect(profile.androgen_status.level).toBe('ok')
    expect(profile.inflammation_status.level).toBe('ok')
    expect(profile.micronutrient_status.level).toBe('ok')
    expect(profile.safety_flags.level).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// Metabolic
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — metabolic', () => {
  it('flags glucose_very_high when glucose >= 126', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 130)])
    expect(p.metabolic_health.level).toBe('critical')
    expect(p.metabolic_health.flags).toContain('glucose_very_high')
  })

  it('flags glucose_elevated when glucose >= 100 and < 126', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 105)])
    expect(p.metabolic_health.level).toBe('caution')
    expect(p.metabolic_health.flags).toContain('glucose_elevated')
  })

  it('flags glucose_low when glucose < 70', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 60)])
    expect(p.metabolic_health.flags).toContain('glucose_low')
  })

  it('flags hba1c_diabetes_range when hba1c >= 6.5', () => {
    const p = buildHealthPerformanceProfile([bm('hba1c', 7.0)])
    expect(p.metabolic_health.level).toBe('critical')
    expect(p.metabolic_health.flags).toContain('hba1c_diabetes_range')
  })

  it('flags hba1c_prediabetes when hba1c >= 5.7 and < 6.5', () => {
    const p = buildHealthPerformanceProfile([bm('hba1c', 6.0)])
    expect(p.metabolic_health.level).toBe('caution')
    expect(p.metabolic_health.flags).toContain('hba1c_prediabetes')
  })

  it('ok when glucose and hba1c are normal', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 90), bm('hba1c', 5.4)])
    expect(p.metabolic_health.level).toBe('ok')
    expect(p.metabolic_health.flags.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Lipids
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — lipids', () => {
  it('flags ldl_very_high when ldl >= 190', () => {
    const p = buildHealthPerformanceProfile([bm('ldl_cholesterol', 195)])
    expect(p.lipid_health.level).toBe('critical')
    expect(p.lipid_health.flags).toContain('ldl_very_high')
  })

  it('flags triglycerides_very_high when trig >= 500', () => {
    const p = buildHealthPerformanceProfile([bm('triglycerides', 520)])
    expect(p.lipid_health.level).toBe('critical')
    expect(p.lipid_health.flags).toContain('triglycerides_very_high')
  })

  it('flags hdl_low when hdl < 40', () => {
    const p = buildHealthPerformanceProfile([bm('hdl_cholesterol', 35)])
    expect(p.lipid_health.flags).toContain('hdl_low')
  })

  it('ok when lipids are normal', () => {
    const p = buildHealthPerformanceProfile([
      bm('ldl_cholesterol', 100),
      bm('hdl_cholesterol', 55),
      bm('triglycerides', 130),
    ])
    expect(p.lipid_health.level).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// Liver
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — liver', () => {
  it('flags ast_very_high when ast > 120', () => {
    const p = buildHealthPerformanceProfile([bm('ast', 150)])
    expect(p.liver_health.level).toBe('critical')
    expect(p.liver_health.flags).toContain('ast_very_high')
  })

  it('flags alt_high when alt > 60 and <= 120', () => {
    const p = buildHealthPerformanceProfile([bm('alt', 80)])
    expect(p.liver_health.level).toBe('caution')
    expect(p.liver_health.flags).toContain('alt_high')
  })

  it('ok when liver enzymes are normal', () => {
    const p = buildHealthPerformanceProfile([bm('ast', 25), bm('alt', 22), bm('ggt', 30)])
    expect(p.liver_health.level).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// Kidney
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — kidney', () => {
  it('flags creatinine_very_high when creatinine >= 2.0', () => {
    const p = buildHealthPerformanceProfile([bm('creatinine', 2.5)])
    expect(p.kidney_hydration.level).toBe('critical')
    expect(p.kidney_hydration.flags).toContain('creatinine_very_high')
  })

  it('flags potassium_high_critical when potassium >= 5.5', () => {
    const p = buildHealthPerformanceProfile([bm('potassium', 5.8)])
    expect(p.kidney_hydration.level).toBe('critical')
    expect(p.kidney_hydration.flags).toContain('potassium_high_critical')
  })

  it('flags egfr_severely_reduced when egfr < 30', () => {
    const p = buildHealthPerformanceProfile([bm('egfr', 20)])
    expect(p.kidney_hydration.level).toBe('critical')
    expect(p.kidney_hydration.flags).toContain('egfr_severely_reduced')
  })

  it('flags potassium_low when potassium < 3.5', () => {
    const p = buildHealthPerformanceProfile([bm('potassium', 3.0)])
    expect(p.kidney_hydration.flags).toContain('potassium_low')
  })
})

// ---------------------------------------------------------------------------
// Hematologic
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — hematologic', () => {
  it('flags hemoglobin_very_low when hgb < 8', () => {
    const p = buildHealthPerformanceProfile([bm('hemoglobin', 7.0)])
    expect(p.hematologic_status.level).toBe('critical')
    expect(p.hematologic_status.flags).toContain('hemoglobin_very_low')
  })

  it('flags ferritin_very_low when ferritin < 12', () => {
    const p = buildHealthPerformanceProfile([bm('ferritin', 8)])
    expect(p.hematologic_status.flags).toContain('ferritin_very_low')
  })

  it('flags b12_low when b12 < 200', () => {
    const p = buildHealthPerformanceProfile([bm('vitamin_b12', 180)])
    expect(p.hematologic_status.flags).toContain('b12_low')
  })
})

// ---------------------------------------------------------------------------
// Thyroid
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — thyroid', () => {
  it('flags tsh_very_high when tsh > 10', () => {
    const p = buildHealthPerformanceProfile([bm('tsh', 12)])
    expect(p.thyroid_status.level).toBe('caution')
    expect(p.thyroid_status.flags).toContain('tsh_very_high')
  })

  it('flags tsh_low when tsh < 0.4', () => {
    const p = buildHealthPerformanceProfile([bm('tsh', 0.2)])
    expect(p.thyroid_status.flags).toContain('tsh_low')
  })
})

// ---------------------------------------------------------------------------
// Androgen
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — androgen', () => {
  it('flags testosterone_very_low when < 200', () => {
    const p = buildHealthPerformanceProfile([bm('testosterone_total', 150)])
    expect(p.androgen_status.level).toBe('caution')
    expect(p.androgen_status.flags).toContain('testosterone_very_low')
  })

  it('flags cortisol_high when > 25', () => {
    const p = buildHealthPerformanceProfile([bm('cortisol', 30)])
    expect(p.androgen_status.flags).toContain('cortisol_high')
  })
})

// ---------------------------------------------------------------------------
// Inflammation
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — inflammation', () => {
  it('flags crp_very_high when crp >= 10', () => {
    const p = buildHealthPerformanceProfile([bm('crp', 12)])
    expect(p.inflammation_status.level).toBe('critical')
    expect(p.inflammation_status.flags).toContain('crp_very_high')
  })

  it('flags homocysteine_elevated when > 12', () => {
    const p = buildHealthPerformanceProfile([bm('homocysteine', 15)])
    expect(p.inflammation_status.flags).toContain('homocysteine_elevated')
  })
})

// ---------------------------------------------------------------------------
// Micronutrients
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — micronutrients', () => {
  it('flags vitamin_d_deficient when < 20', () => {
    const p = buildHealthPerformanceProfile([bm('vitamin_d', 12)])
    expect(p.micronutrient_status.flags).toContain('vitamin_d_deficient')
  })

  it('flags vitamin_d_insufficient when 20-29', () => {
    const p = buildHealthPerformanceProfile([bm('vitamin_d', 25)])
    expect(p.micronutrient_status.flags).toContain('vitamin_d_insufficient')
  })

  it('ok when vitamin_d normal', () => {
    const p = buildHealthPerformanceProfile([bm('vitamin_d', 45)])
    expect(p.micronutrient_status.flags.filter((f) => f.includes('vitamin_d'))).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Training readiness composite
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — training_readiness', () => {
  it('is critical when critical markers present', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 135)])
    expect(p.training_readiness.level).toBe('critical')
  })

  it('has no limiting flags when all markers normal', () => {
    const p = buildHealthPerformanceProfile([
      bm('glucose', 90),
      bm('ldl_cholesterol', 100),
      bm('hemoglobin', 15),
    ])
    expect(p.training_readiness.level).toBe('ok')
    expect(p.training_readiness.notes.join('')).toContain('Sem sinais limitantes')
  })
})

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------
describe('buildHealthPerformanceProfile — scores', () => {
  it('all scores are numbers between 0 and 100', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 90), bm('ldl_cholesterol', 100)])
    const scores = p.scores
    for (const [key, val] of Object.entries(scores)) {
      expect(typeof val).toBe('number')
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(100)
    }
  })

  it('metabolic_score is lower when glucose is elevated', () => {
    const bad = buildHealthPerformanceProfile([bm('glucose', 130)])
    const good = buildHealthPerformanceProfile([bm('glucose', 90)])
    expect(bad.scores.metabolic_score).toBeLessThan(good.scores.metabolic_score)
  })
})

// ---------------------------------------------------------------------------
// parsedFromBiomarkers
// ---------------------------------------------------------------------------
describe('parsedFromBiomarkers', () => {
  it('maps canonical biomarker keys to ParsedLabReport fields', () => {
    const biomarkers: BiomarkerEntry[] = [
      bm('glucose', 95),
      bm('hba1c', 5.5),
      bm('ldl_cholesterol', 110),
      bm('creatinine', 1.0),
      bm('potassium', 4.1),
      bm('tsh', 2.0),
      bm('vitamin_d', 35),
    ]
    const parsed = parsedFromBiomarkers(biomarkers)
    expect(parsed.glucose).toBe(95)
    expect(parsed.hba1c).toBe(5.5)
    expect(parsed.ldl).toBe(110)
    expect(parsed.creatinine).toBe(1.0)
    expect(parsed.potassium).toBe(4.1)
    expect(parsed.tsh).toBe(2.0)
    expect(parsed.vitamin_d).toBe(35)
  })

  it('returns null for missing keys', () => {
    const parsed = parsedFromBiomarkers([bm('glucose', 90)])
    expect(parsed.hba1c).toBeNull()
    expect(parsed.testosterone_total).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// applyClinicalRulesFromBiomarkers
// ---------------------------------------------------------------------------
describe('applyClinicalRulesFromBiomarkers', () => {
  it('returns standard mode with no flags for normal biomarkers', () => {
    const result = applyClinicalRulesFromBiomarkers([
      bm('glucose', 90),
      bm('ldl_cholesterol', 100),
    ])
    expect(result.mode).toBe('standard')
    expect(result.clinicalFlags).toHaveLength(0)
    expect(result.criticalFlags).toHaveLength(0)
  })

  it('returns clinical mode with hyperglycemia_alert for glucose >= 126', () => {
    const result = applyClinicalRulesFromBiomarkers([bm('glucose', 130)])
    expect(result.mode).toBe('clinical')
    expect(result.criticalFlags).toContain('hyperglycemia_alert')
  })

  it('returns clinical mode for elevated LDL', () => {
    const result = applyClinicalRulesFromBiomarkers([bm('ldl_cholesterol', 165)])
    expect(result.clinicalFlags).toContain('high_ldl')
    expect(result.criticalFlags).toContain('ldl_alert')
  })

  it('returns critical flags for kidney alert', () => {
    const result = applyClinicalRulesFromBiomarkers([bm('creatinine', 2.5)])
    expect(result.criticalFlags).toContain('kidney_alert')
  })

  it('returns critical flags for crp_critical', () => {
    const result = applyClinicalRulesFromBiomarkers([bm('crp', 12)])
    expect(result.criticalFlags).toContain('crp_critical')
  })
})

// ---------------------------------------------------------------------------
// serializeHealthProfile
// ---------------------------------------------------------------------------
describe('serializeHealthProfile', () => {
  it('produces non-empty string output', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 90), bm('tsh', 2.5)])
    const text = serializeHealthProfile(p)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(50)
    expect(text).toContain('PERFIL DE SAÚDE')
    expect(text).toContain('Scores:')
  })

  it('includes safety section when critical flags present', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 135)])
    const text = serializeHealthProfile(p)
    expect(text).toContain('SINAIS DE SEGURANÇA')
  })

  it('does not include safety section when all ok', () => {
    const p = buildHealthPerformanceProfile([bm('glucose', 90)])
    const text = serializeHealthProfile(p)
    expect(text).not.toContain('SINAIS DE SEGURANÇA')
  })
})
