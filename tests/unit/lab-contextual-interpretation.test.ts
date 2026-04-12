import test from 'node:test'
import assert from 'node:assert/strict'

import { enrichBiomarkerEntries, summarizeMarkerInterpretations } from '../../src/core/labs/labInterpretation'
import { buildHealthPerformanceProfile } from '../../src/core/labs/labHealthProfile'
import { applyClinicalRulesFromBiomarkers } from '../../src/core/labs/labRules'
import type { BiomarkerEntry } from '../../src/core/labs/labTypes'

function biomarker(input: Partial<BiomarkerEntry> & Pick<BiomarkerEntry, 'marker_key' | 'marker_name'>): BiomarkerEntry {
  return {
    marker_key: input.marker_key,
    marker_name: input.marker_name,
    value_numeric: input.value_numeric ?? null,
    value_text: input.value_text ?? (input.value_numeric != null ? String(input.value_numeric) : null),
    unit: input.unit ?? null,
    reference_min: input.reference_min ?? null,
    reference_max: input.reference_max ?? null,
    reference_text: input.reference_text ?? null,
    flag: input.flag ?? null,
    source_line: input.source_line ?? null,
    confidence: input.confidence ?? 0.98,
    reference_text_raw: input.reference_text_raw ?? null,
    normalized_reference: input.normalized_reference ?? null,
    lab_flag: input.lab_flag ?? null,
    context_flag: input.context_flag ?? null,
    interpretation_mode: input.interpretation_mode ?? null,
    monitor_priority: input.monitor_priority ?? null,
    safety_relevance: input.safety_relevance ?? null,
    feedback_summary: input.feedback_summary ?? null,
    source_reference_kind: input.source_reference_kind ?? null,
  }
}

const maleAssistedProfile = {
  sex: 'male',
  birth_date: '1993-01-20',
  hormone_context_type: 'assisted',
  uses_exogenous_hormones: true,
  declared_compounds: ['testosterone enanthate'],
  monitoring_mode: 'assisted',
}

const maleNaturalProfile = {
  sex: 'male',
  birth_date: '1993-01-20',
  hormone_context_type: 'natural',
  uses_exogenous_hormones: false,
  monitoring_mode: 'natural',
}

test('seleciona faixa masculina adulta a partir do reference_text e marca testosterona total alta no laudo', () => {
  const [result] = enrichBiomarkerEntries([
    biomarker({
      marker_key: 'testosterone_total',
      marker_name: 'Testosterona Total',
      value_numeric: 1231.75,
      unit: 'ng/dL',
      reference_text: 'Homens 18 a 66 anos: 175,00 a 781,00 ng/dL | Mulheres 21 a 73 anos: 10,00 a 75,00 ng/dL',
    }),
  ], maleAssistedProfile)

  assert.equal(result.reference_min, 175)
  assert.equal(result.reference_max, 781)
  assert.equal(result.lab_flag, 'high')
  assert.equal(result.context_flag, 'compatible_with_declared_exogenous_testosterone_use')
  assert.equal(result.source_reference_kind, 'sex_age')
})

test('LH e FSH baixos são contextualizados como supressão esperada apenas em contexto assistido', () => {
  const lh = biomarker({
    marker_key: 'lh',
    marker_name: 'LH',
    value_numeric: 0.19,
    unit: 'mUI/mL',
    reference_text: 'Homens adultos: 1,7 a 8,6 mUI/mL',
  })
  const fsh = biomarker({
    marker_key: 'fsh',
    marker_name: 'FSH',
    value_numeric: 0.20,
    unit: 'mUI/mL',
    reference_text: 'Homens adultos: 1,5 a 12,4 mUI/mL',
  })

  const assisted = enrichBiomarkerEntries([lh, fsh], maleAssistedProfile)
  assert.equal(assisted[0].lab_flag, 'low')
  assert.equal(assisted[0].context_flag, 'expected_axis_suppression_under_declared_testosterone_use')
  assert.equal(assisted[1].context_flag, 'expected_axis_suppression_under_declared_testosterone_use')

  const natural = enrichBiomarkerEntries([lh, fsh], maleNaturalProfile)
  assert.equal(natural[0].context_flag, 'clinically_relevant_without_declared_hormone_context')
  assert.equal(natural[1].context_flag, 'clinically_relevant_without_declared_hormone_context')
})

test('vitamina D 22,2 pode ficar normal no laudo e receber apenas observação secundária', () => {
  const [vitaminD] = enrichBiomarkerEntries([
    biomarker({
      marker_key: 'vitamin_d',
      marker_name: 'Vitamina D',
      value_numeric: 22.2,
      unit: 'ng/mL',
      reference_text: 'Adultos: 20,0 a 60,0 ng/mL',
    }),
  ], maleNaturalProfile)

  assert.equal(vitaminD.lab_flag, 'normal')
  assert.match(String(vitaminD.feedback_summary), /observação secundária/i)

  const profile = buildHealthPerformanceProfile([vitaminD])
  assert.equal(profile.micronutrient_status.level, 'ok')
})

test('T4 livre usa a faixa adulta correta e não cai em low por threshold fixo legado', () => {
  const [t4] = enrichBiomarkerEntries([
    biomarker({
      marker_key: 't4_free',
      marker_name: 'T4 Livre',
      value_numeric: 0.69,
      unit: 'ng/dL',
      reference_text: 'Adultos: 0,54 a 1,24 ng/dL',
    }),
  ], maleNaturalProfile)

  assert.equal(t4.lab_flag, 'normal')

  const profile = buildHealthPerformanceProfile([t4])
  assert.equal(profile.thyroid_status.level, 'ok')
})

test('HDL baixo segue relevante em qualquer contexto e entra como prioridade alta', () => {
  const [hdl] = enrichBiomarkerEntries([
    biomarker({
      marker_key: 'hdl_cholesterol',
      marker_name: 'HDL',
      value_numeric: 33,
      unit: 'mg/dL',
      reference_text: 'Adultos acima de 20 anos: Superior a 40 mg/dL',
    }),
  ], maleAssistedProfile)

  assert.equal(hdl.lab_flag, 'low')
  assert.equal(hdl.context_flag, 'clinically_relevant_even_with_declared_hormone_context')
  assert.equal(hdl.monitor_priority, 'high')
})

test('regras clínicas não normalizam vitamina D normal no laudo e sinalizam testosterona inesperada em natural', () => {
  const [vitaminD, testosterone] = enrichBiomarkerEntries([
    biomarker({
      marker_key: 'vitamin_d',
      marker_name: 'Vitamina D',
      value_numeric: 22.2,
      unit: 'ng/mL',
      reference_text: 'Adultos: 20,0 a 60,0 ng/mL',
    }),
    biomarker({
      marker_key: 'testosterone_total',
      marker_name: 'Testosterona Total',
      value_numeric: 1231.75,
      unit: 'ng/dL',
      reference_text: 'Homens 18 a 66 anos: 175,00 a 781,00 ng/dL | Mulheres 21 a 73 anos: 10,00 a 75,00 ng/dL',
    }),
  ], maleNaturalProfile)

  const result = applyClinicalRulesFromBiomarkers([vitaminD, testosterone])
  assert.ok(!result.clinicalFlags.includes('low_vitamin_d'))
  assert.ok(result.clinicalFlags.includes('unexpected_testosterone_for_declared_context'))
})

test('sumário contextual prioriza feedback esportivo sem perder o laudo', () => {
  const enriched = enrichBiomarkerEntries([
    biomarker({
      marker_key: 'testosterone_total',
      marker_name: 'Testosterona Total',
      value_numeric: 1231.75,
      unit: 'ng/dL',
      reference_text: 'Homens 18 a 66 anos: 175,00 a 781,00 ng/dL | Mulheres 21 a 73 anos: 10,00 a 75,00 ng/dL',
    }),
    biomarker({
      marker_key: 'hematocrit',
      marker_name: 'Hematócrito',
      value_numeric: 54,
      unit: '%',
      reference_text: 'Homens: 41 a 53 %',
    }),
  ], maleAssistedProfile)

  const summary = summarizeMarkerInterpretations(enriched)
  assert.match(String(summary), /compatível com a intervenção/i)
  assert.match(String(summary), /Hematócrito/)
})

test('referência ambígua sem sexo/idade disponível fica marcada como ambígua e sem range resolvido', () => {
  const [result] = enrichBiomarkerEntries([
    biomarker({
      marker_key: 'testosterone_total',
      marker_name: 'Testosterona Total',
      value_numeric: 310,
      unit: 'ng/dL',
      reference_text: 'Homens 18 a 66 anos: 175,00 a 781,00 ng/dL | Mulheres 21 a 73 anos: 10,00 a 75,00 ng/dL',
    }),
  ], null)

  assert.equal(result.reference_min, null)
  assert.equal(result.reference_max, null)
  assert.equal(result.source_reference_kind, 'ambiguous')
  assert.equal(result.normalized_reference?.matched_by, 'ambiguous')
})
