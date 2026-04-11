import test from "node:test"
import assert from "node:assert/strict"

import { getLatestValidLabReport, getUserLabLongitudinalContext, resolveAllowedLabMimeType } from "../../src/core/labs/labRepository"

function createListQueryResult(data: Array<Record<string, unknown>>) {
  return {
    select() { return this },
    eq() { return this },
    order() { return this },
    limit: async () => ({ data, error: null }),
  }
}

test("resolveAllowedLabMimeType aceita MIME válido direto", () => {
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "application/pdf", filename: "exame.pdf" }),
    "application/pdf",
  )
})

test("resolveAllowedLabMimeType normaliza aliases comuns de imagem", () => {
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "image/jpg", filename: "foto.jpg" }),
    "image/jpeg",
  )
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "image/x-png", filename: "foto.png" }),
    "image/png",
  )
})

test("resolveAllowedLabMimeType faz fallback pelo nome do arquivo quando file.type vem vazio", () => {
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "", filename: "meu-exame.PDF" }),
    "application/pdf",
  )
  assert.equal(
    resolveAllowedLabMimeType({ mimeType: "application/octet-stream", filename: "foto.jpeg" }),
    "image/jpeg",
  )
})

test("resolveAllowedLabMimeType rejeita extensão inválida", () => {
  assert.throws(
    () => resolveAllowedLabMimeType({ mimeType: "", filename: "planilha.xls" }),
    /Tipo de arquivo inválido/,
  )
})

test("getLatestValidLabReport preserva null em biomarcador e não converte ausência para zero", async () => {
  const admin = {
    from() {
      return createListQueryResult([
        {
          id: "lab-null",
          parsed: null,
          normalized_payload: {
            biomarkers: [
              {
                marker_key: "glucose",
                marker_name: "Glicose",
                value_numeric: null,
                reference_min: 70,
                reference_max: 99,
                flag: null,
              },
            ],
          },
          ai_insights: null,
          confidence: 0.9,
          is_valid: true,
          clinical_flags: [],
          critical_flags: [],
          created_at: "2026-04-10T10:00:00.000Z",
          processed_at: "2026-04-10T10:05:00.000Z",
        },
      ])
    },
  } as never

  const result = await getLatestValidLabReport(admin, "user-null")
  assert.ok(result)
  assert.equal(result?.parsed?.glucose, null)
})

test("getUserLabLongitudinalContext compara exames válidos e classifica melhora, piora e persistência", async () => {
  const admin = {
    from() {
      return createListQueryResult([
        {
          id: "lab-latest",
          parsed: null,
          normalized_payload: {
            biomarkers: [
              { marker_key: "glucose", marker_name: "Glicose", value_numeric: 110, reference_min: 70, reference_max: 99, flag: "high" },
              { marker_key: "ferritin", marker_name: "Ferritina", value_numeric: 18, reference_min: 30, reference_max: 400, flag: "low" },
              { marker_key: "vitamin_d", marker_name: "Vitamina D", value_numeric: 34, reference_min: 30, reference_max: 100, flag: "normal" },
            ],
          },
          ai_insights: {
            health_profile: {
              metabolic_health: { level: "caution", flags: ["glucose_elevated"], notes: [] },
              lipid_health: { level: "ok", flags: [], notes: [] },
              liver_health: { level: "ok", flags: [], notes: [] },
              kidney_hydration: { level: "ok", flags: [], notes: [] },
              hematologic_status: { level: "attention", flags: ["ferritin_low"], notes: [] },
              thyroid_status: { level: "ok", flags: [], notes: [] },
              androgen_status: { level: "ok", flags: [], notes: [] },
              inflammation_status: { level: "ok", flags: [], notes: [] },
              micronutrient_status: { level: "ok", flags: [], notes: [] },
              training_readiness: { level: "attention", flags: [], notes: [] },
              recovery_risk: { level: "attention", flags: [], notes: [] },
              dietary_attention_points: { level: "attention", flags: [], notes: [] },
              safety_flags: { level: "attention", flags: [], notes: [] },
              scores: {
                metabolic_score: 60,
                recovery_score: 62,
                hematologic_score: 58,
                hormonal_score: 88,
                safety_score: 80,
                lipid_score: 90,
                liver_score: 92,
                kidney_score: 91,
              },
            },
            clinical_flags: ["pre_diabetes", "low_ferritin"],
            critical_flags: [],
          },
          confidence: 0.91,
          is_valid: true,
          clinical_flags: [],
          critical_flags: [],
          created_at: "2026-04-10T10:00:00.000Z",
          processed_at: "2026-04-10T10:05:00.000Z",
        },
        {
          id: "lab-previous",
          parsed: null,
          normalized_payload: {
            biomarkers: [
              { marker_key: "glucose", marker_name: "Glicose", value_numeric: 96, reference_min: 70, reference_max: 99, flag: "normal" },
              { marker_key: "ferritin", marker_name: "Ferritina", value_numeric: 22, reference_min: 30, reference_max: 400, flag: "low" },
              { marker_key: "vitamin_d", marker_name: "Vitamina D", value_numeric: 24, reference_min: 30, reference_max: 100, flag: "low" },
            ],
          },
          ai_insights: {
            health_profile: {
              metabolic_health: { level: "ok", flags: [], notes: [] },
              lipid_health: { level: "ok", flags: [], notes: [] },
              liver_health: { level: "ok", flags: [], notes: [] },
              kidney_hydration: { level: "ok", flags: [], notes: [] },
              hematologic_status: { level: "attention", flags: ["ferritin_low"], notes: [] },
              thyroid_status: { level: "ok", flags: [], notes: [] },
              androgen_status: { level: "ok", flags: [], notes: [] },
              inflammation_status: { level: "ok", flags: [], notes: [] },
              micronutrient_status: { level: "attention", flags: ["vitamin_d_low"], notes: [] },
              training_readiness: { level: "ok", flags: [], notes: [] },
              recovery_risk: { level: "ok", flags: [], notes: [] },
              dietary_attention_points: { level: "attention", flags: [], notes: [] },
              safety_flags: { level: "ok", flags: [], notes: [] },
              scores: {
                metabolic_score: 82,
                recovery_score: 78,
                hematologic_score: 61,
                hormonal_score: 88,
                safety_score: 86,
                lipid_score: 90,
                liver_score: 92,
                kidney_score: 91,
              },
            },
            clinical_flags: ["low_ferritin", "low_vitamin_d"],
            critical_flags: [],
          },
          confidence: 0.9,
          is_valid: true,
          clinical_flags: [],
          critical_flags: [],
          created_at: "2026-03-10T10:00:00.000Z",
          processed_at: "2026-03-10T10:05:00.000Z",
        },
      ])
    },
  } as never

  const context = await getUserLabLongitudinalContext(admin, "user-longitudinal")
  assert.ok(context)
  assert.equal(context?.latestReportId, "lab-latest")
  assert.ok(context?.newAlertMarkers.includes("Glicose"))
  assert.ok(context?.persistentAbnormalMarkers.includes("Ferritina"))
  assert.ok(context?.improvingMarkers.includes("Vitamina D"))
  assert.match(String(context?.summaryText), /Histórico com 2 exame/)
})

test("getUserLabLongitudinalContext não marca persistência clínica quando as flags mudam entre exames", async () => {
  const admin = {
    from() {
      return createListQueryResult([
        {
          id: "lab-current",
          parsed: null,
          normalized_payload: {
            biomarkers: [
              { marker_key: "glucose", marker_name: "Glicose", value_numeric: 108, reference_min: 70, reference_max: 99, flag: "high" },
            ],
          },
          ai_insights: {
            health_profile: {
              metabolic_health: { level: "attention", flags: ["glucose_elevated"], notes: [] },
              lipid_health: { level: "ok", flags: [], notes: [] },
              liver_health: { level: "ok", flags: [], notes: [] },
              kidney_hydration: { level: "ok", flags: [], notes: [] },
              hematologic_status: { level: "ok", flags: [], notes: [] },
              thyroid_status: { level: "ok", flags: [], notes: [] },
              androgen_status: { level: "ok", flags: [], notes: [] },
              inflammation_status: { level: "ok", flags: [], notes: [] },
              micronutrient_status: { level: "ok", flags: [], notes: [] },
              training_readiness: { level: "attention", flags: [], notes: [] },
              recovery_risk: { level: "attention", flags: [], notes: [] },
              dietary_attention_points: { level: "attention", flags: [], notes: [] },
              safety_flags: { level: "ok", flags: [], notes: [] },
              scores: {
                metabolic_score: 70,
                recovery_score: 70,
                hematologic_score: 90,
                hormonal_score: 88,
                safety_score: 84,
                lipid_score: 91,
                liver_score: 94,
                kidney_score: 93,
              },
            },
            clinical_flags: ["pre_diabetes"],
            critical_flags: [],
          },
          confidence: 0.91,
          is_valid: true,
          clinical_flags: [],
          critical_flags: [],
          created_at: "2026-04-10T10:00:00.000Z",
          processed_at: "2026-04-10T10:05:00.000Z",
        },
        {
          id: "lab-previous-other-flag",
          parsed: null,
          normalized_payload: {
            biomarkers: [
              { marker_key: "ferritin", marker_name: "Ferritina", value_numeric: 20, reference_min: 30, reference_max: 400, flag: "low" },
            ],
          },
          ai_insights: {
            health_profile: {
              metabolic_health: { level: "ok", flags: [], notes: [] },
              lipid_health: { level: "ok", flags: [], notes: [] },
              liver_health: { level: "ok", flags: [], notes: [] },
              kidney_hydration: { level: "ok", flags: [], notes: [] },
              hematologic_status: { level: "attention", flags: ["ferritin_low"], notes: [] },
              thyroid_status: { level: "ok", flags: [], notes: [] },
              androgen_status: { level: "ok", flags: [], notes: [] },
              inflammation_status: { level: "ok", flags: [], notes: [] },
              micronutrient_status: { level: "ok", flags: [], notes: [] },
              training_readiness: { level: "ok", flags: [], notes: [] },
              recovery_risk: { level: "ok", flags: [], notes: [] },
              dietary_attention_points: { level: "attention", flags: [], notes: [] },
              safety_flags: { level: "ok", flags: [], notes: [] },
              scores: {
                metabolic_score: 84,
                recovery_score: 80,
                hematologic_score: 61,
                hormonal_score: 88,
                safety_score: 84,
                lipid_score: 91,
                liver_score: 94,
                kidney_score: 93,
              },
            },
            clinical_flags: ["low_ferritin"],
            critical_flags: [],
          },
          confidence: 0.9,
          is_valid: true,
          clinical_flags: [],
          critical_flags: [],
          created_at: "2026-03-10T10:00:00.000Z",
          processed_at: "2026-03-10T10:05:00.000Z",
        },
      ])
    },
  } as never

  const context = await getUserLabLongitudinalContext(admin, "user-longitudinal-mismatch")
  assert.ok(context)
  assert.equal(context?.signals.clinicalPersistence, "alerta recente")
})
