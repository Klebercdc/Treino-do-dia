import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { decideClinicalGate } from '../../src/server/internal/labReports/canonical'
import { enrichBiomarkerEntries } from '../../src/core/labs/labInterpretation'

const naturalProfile = {
  sex: 'male',
  birth_date: '1993-01-20',
  hormone_context_type: 'natural',
  uses_exogenous_hormones: false,
  monitoring_mode: 'natural',
}

test('gate clínico bloqueia referência ambígua por sexo sem contexto suficiente', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'testosterone_total',
    marker_name: 'Testosterona Total',
    value_numeric: 310,
    value_text: '310',
    unit: 'ng/dL',
    reference_min: null,
    reference_max: null,
    reference_text: 'Homens 18 a 66 anos: 175 a 781 ng/dL | Mulheres 21 a 73 anos: 10 a 75 ng/dL',
    flag: null,
    source_line: 'TESTOSTERONA TOTAL Resultado: 310 ng/dL',
    confidence: 0.98,
  }], null)

  const decision = decideClinicalGate({
    biomarkers: [marker as unknown as Record<string, unknown>],
    confidenceSummary: { mean_confidence: 0.98 },
    extractionWarnings: [],
  })

  assert.equal(decision.releaseAllowed, false)
  assert.equal(decision.canonicalStatus, 'needs_clinical_review')
  assert.match(decision.warnings.join(','), /ambiguous_reference|unresolved_reference/)
})

test('gate clínico libera apenas caso com referência resolvida e confiança adequada', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'glucose',
    marker_name: 'Glicose',
    value_numeric: 92,
    value_text: '92',
    unit: 'mg/dL',
    reference_min: null,
    reference_max: null,
    reference_text: 'Adultos: 70 a 99 mg/dL',
    flag: null,
    source_line: 'GLICOSE Resultado: 92 mg/dL',
    confidence: 0.98,
  }], naturalProfile)

  const decision = decideClinicalGate({
    biomarkers: [marker as unknown as Record<string, unknown>],
    confidenceSummary: { mean_confidence: 0.98 },
    extractionWarnings: [],
  })

  assert.equal(decision.releaseAllowed, true)
  assert.equal(decision.canonicalStatus, 'released_to_patient')
  assert.equal(decision.legacyStatus, 'analyzed')
  assert.equal(decision.reviewStatus, 'released')
})

test('migration 046 adiciona status canônico, review_status e snapshots append-only', () => {
  const source = readFileSync('supabase/migrations/046_lab_reports_canonical_clinical_consolidation.sql', 'utf-8')
  assert.match(source, /canonical_status/)
  assert.match(source, /review_status/)
  assert.match(source, /machine_snapshot/)
  assert.match(source, /released_snapshot/)
  assert.match(source, /lab_report_snapshot_versions/)
  assert.match(source, /snapshot_kind in \('machine', 'reviewed', 'released'\)/)
})

test('patient detail route não expõe machine_snapshot não liberado', () => {
  const source = readFileSync('src/app/api/kronia/labs/reports/[id]/route.ts', 'utf-8')
  assert.match(source, /reviewStatus === 'released'/)
  assert.match(source, /machine_snapshot: reviewStatus === 'released'/)
  assert.match(source, /releasedSnapshot/)
})

// ─── Fix: referências ambíguas não devem gerar flag falso-normal ──────────────

test('SHBG 8,4 em homem com referência multi-sexo resolve como low', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'shbg',
    marker_name: 'SHBG',
    value_numeric: 8.4,
    value_text: '8,4',
    unit: 'nmol/L',
    reference_min: null,
    reference_max: null,
    reference_text: 'SHBG Homens de 20 a 70 anos: 13,2 a 89,5 nmol/L | Mulheres de 20 a 46 anos: 18,2 a 135,7 nmol/L | Mulheres de 47 a 91 anos (Pós-Menopausa): 16,8 a 125,2 nmol/L',
    flag: null,
    source_line: null,
    confidence: 0.98,
  }], { sex: 'male', birth_date: '1990-01-01' })

  assert.equal(marker.lab_flag, 'low', 'SHBG 8,4 abaixo de 13,2 deve ser low para homem')
  assert.ok(marker.source_reference_kind === 'sex_age' || marker.source_reference_kind === 'sex',
    `esperado sex ou sex_age, recebido: ${marker.source_reference_kind}`)
  assert.equal(marker.reference_min, 13.2)
  assert.equal(marker.reference_max, 89.5)
})

test('SHBG 7,2 em homem com referência multi-sexo resolve como low', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'shbg',
    marker_name: 'SHBG',
    value_numeric: 7.2,
    value_text: '7,2',
    unit: 'nmol/L',
    reference_min: null,
    reference_max: null,
    reference_text: 'SHBG Resultado: 7,2 nmol/L Homens de 20 a 70 anos: 13,2 a 89,5 nmol/L | Mulheres de 20 a 46 anos: 18,2 a 135,7 nmol/L | Mulheres de 47 a 91 anos (Pós-Menopausa): 16,8 a 125,2 nmol/L',
    flag: 'normal',
    source_line: null,
    confidence: 0.98,
  }], { sex: 'male', birth_date: '1993-01-20' })

  assert.equal(marker.lab_flag, 'low', 'SHBG 7,2 abaixo de 13,2 deve ser low, não normal falso')
})

test('PSA livre com laudo declarando ausência de referência não bloqueia o gate', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'psa_free',
    marker_name: 'PSA Livre',
    value_numeric: 0.12,
    value_text: '0,12',
    unit: 'ng/mL',
    reference_min: null,
    reference_max: null,
    reference_text: 'Não há valores de referência definidos para este exame, devendo correlacionar-se com o PSA total.',
    flag: null,
    source_line: null,
    confidence: 0.98,
  }], { sex: 'male', birth_date: '1990-01-01' })

  assert.equal(marker.source_reference_kind, 'no_reference',
    'laudo sem referência por design deve ter source_reference_kind=no_reference')
  assert.equal(marker.lab_flag, null)

  const decision = decideClinicalGate({
    biomarkers: [marker as unknown as Record<string, unknown>],
    confidenceSummary: { mean_confidence: 0.98 },
    extractionWarnings: [],
  })

  assert.ok(!decision.warnings.some((w) => w.includes('psa_free:unresolved')),
    'psa_free com no_reference não deve gerar unresolved_reference no gate')
  assert.equal(decision.releaseAllowed, true)
})

test('triglicérides com referência fasting/não-fasting usa jejum como padrão conservador', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'triglycerides',
    marker_name: 'Triglicérides',
    value_numeric: 110,
    value_text: '110',
    unit: 'mg/dL',
    reference_min: null,
    reference_max: null,
    reference_text: 'Com jejum: Inferior a 150 mg/dL | Sem jejum: Inferior a 175 mg/dL',
    flag: null,
    source_line: null,
    confidence: 0.98,
  }], { sex: 'male', birth_date: '1990-01-01' })

  assert.equal(marker.reference_max, 150, 'deve usar threshold de jejum (<150) como padrão')
  assert.equal(marker.lab_flag, 'normal', 'triglicérides 110 é normal dentro da faixa de jejum')
  assert.ok(marker.source_reference_kind !== 'ambiguous',
    'triglicérides fasting/não-fasting não deve ficar ambíguo')
})

test('referência ambígua sem sexo/perfil retorna labFlag null, não normal falso', () => {
  const [marker] = enrichBiomarkerEntries([{
    marker_key: 'shbg',
    marker_name: 'SHBG',
    value_numeric: 7.2,
    value_text: '7,2',
    unit: 'nmol/L',
    reference_min: null,
    reference_max: null,
    reference_text: 'Homens de 20 a 70 anos: 13,2 a 89,5 nmol/L | Mulheres de 20 a 46 anos: 18,2 a 135,7 nmol/L | Mulheres de 47 a 91 anos (Pós-Menopausa): 16,8 a 125,2 nmol/L',
    flag: 'normal',
    source_line: null,
    confidence: 0.98,
  }], null)

  assert.equal(marker.source_reference_kind, 'ambiguous')
  assert.equal(marker.lab_flag, null, 'sem perfil, flag deve ser null — nunca normal falso')

  const decision = decideClinicalGate({
    biomarkers: [marker as unknown as Record<string, unknown>],
    confidenceSummary: { mean_confidence: 0.98 },
    extractionWarnings: [],
  })

  assert.equal(decision.releaseAllowed, false, 'referência ambígua sem sexo deve bloquear o gate')
  assert.ok(decision.warnings.some((w) => w.includes('shbg:')),
    'deve haver aviso para shbg no gate')
})
