const test = require('node:test');
const assert = require('node:assert/strict');

const helper = require('../../src/server/internal/labReports/readModel');

test('isMissingOptionalRelation reconhece ausência via schema cache e via relation does not exist', () => {
  assert.equal(
    helper.isMissingOptionalRelation({
      code: 'PGRST205',
      message: "Could not find the table 'public.lab_report_biomarkers' in the schema cache",
    }, 'lab_report_biomarkers'),
    true,
  );

  assert.equal(
    helper.isMissingOptionalRelation({
      code: '42P01',
      message: 'relation "public.lab_report_extractions" does not exist',
    }, 'lab_report_extractions'),
    true,
  );
});

test('resolveReportBiomarkers faz fallback para normalized_payload quando a tabela auxiliar não tem linhas do report', () => {
  const report = {
    id: 'lab-1',
    normalized_payload: {
      biomarkers: [
        { marker_key: 'glucose', marker_name: 'Glicose', value_numeric: 99 },
      ],
    },
  };

  const biomarkerMap = new Map();
  assert.deepEqual(helper.resolveReportBiomarkers(report, biomarkerMap), report.normalized_payload.biomarkers);
});

test('resolveReportExtractions faz fallback para extraction inline quando a tabela auxiliar não tem linhas', () => {
  const report = {
    id: 'lab-1',
    extraction_mode: 'ocr',
    created_at: '2026-04-11T00:00:00Z',
    processed_at: '2026-04-11T00:05:00Z',
    confidence_summary: { mean_confidence: 0.8 },
    normalized_payload: {
      extraction: {
        engine: 'exam_ocr_python',
        raw_text: 'texto',
      },
    },
  };

  const rows = helper.resolveReportExtractions(report, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lab_report_id, 'lab-1');
  assert.equal(rows[0].raw_text, 'texto');
});
