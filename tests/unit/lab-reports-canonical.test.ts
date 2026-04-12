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
