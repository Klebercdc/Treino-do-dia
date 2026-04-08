import test from "node:test"
import assert from "node:assert/strict"

import { validateLabReport } from "../../src/core/labs/labValidator"
import { applyClinicalRules, resolveDietMode } from "../../src/core/labs/labRules"

test("validateLabReport aceita biomarcadores plausíveis", () => {
  const result = validateLabReport({
    glucose: 96,
    hba1c: 5.4,
    creatinine: 0.9,
    potassium: 4.4,
    sodium: 140,
    cholesterol_total: 180,
    hdl: 52,
    ldl: 108,
    triglycerides: 110,
  })

  assert.equal(result.isValid, true)
  assert.equal(result.validationErrors.length, 0)
  assert.ok(result.confidence > 0.8)
})

test("validateLabReport invalida valores absurdos", () => {
  const result = validateLabReport({
    glucose: 700,
    hba1c: 5.8,
    creatinine: 0.8,
    potassium: 4.2,
    sodium: 140,
    cholesterol_total: 200,
    hdl: 48,
    ldl: 130,
    triglycerides: 140,
  })

  assert.equal(result.isValid, false)
  assert.ok(result.validationErrors.includes("glucose_out_of_range"))
})

test("applyClinicalRules ativa clinical mode e flags esperadas", () => {
  const clinical = applyClinicalRules({
    glucose: 108,
    hba1c: 5.9,
    creatinine: 1.0,
    potassium: 5.2,
    sodium: 139,
    cholesterol_total: 220,
    hdl: 44,
    ldl: 146,
    triglycerides: 160,
  })

  assert.equal(clinical.mode, "clinical")
  assert.ok(clinical.clinicalFlags.includes("pre_diabetes"))
  assert.ok(clinical.clinicalFlags.includes("glycemic_risk"))
  assert.ok(clinical.clinicalFlags.includes("high_potassium"))
  assert.ok(clinical.clinicalFlags.includes("high_ldl"))
})

test("applyClinicalRules mantém standard quando o exame é válido mas sem gatilhos clínicos", () => {
  const clinical = applyClinicalRules({
    glucose: 92,
    hba1c: 5.3,
    creatinine: 0.9,
    potassium: 4.3,
    sodium: 140,
    cholesterol_total: 178,
    hdl: 58,
    ldl: 102,
    triglycerides: 96,
  })

  assert.equal(clinical.mode, "standard")
  assert.deepEqual(clinical.clinicalFlags, [])
  assert.deepEqual(clinical.criticalFlags, [])
})

test("resolveDietMode volta para standard sem exame válido", () => {
  assert.equal(resolveDietMode(null), "standard")
  assert.equal(resolveDietMode({ is_valid: false, parsed: null }), "standard")
  assert.equal(resolveDietMode({ is_valid: true, parsed: { glucose: 90 } as any }), "clinical")
})
