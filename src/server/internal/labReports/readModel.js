function relationMissingMessage(table) {
  return new RegExp(`(?:table|relation) ['"]?public\\.${table}['"]?(?: in the schema cache)? (?:does not exist|was not found)|could not find the table ['"]?public\\.${table}['"]?`, 'i');
}

function isMissingOptionalRelation(error, table) {
  if (!error || typeof error !== 'object') return false;
  var code = String(error.code || '');
  var message = String(error.message || '');
  if (code === 'PGRST205' || code === '42P01') return relationMissingMessage(table).test(message);
  return relationMissingMessage(table).test(message);
}

function extractBiomarkersFromNormalizedPayload(report) {
  var payload = report && report.normalized_payload && typeof report.normalized_payload === 'object'
    ? report.normalized_payload
    : null;
  return payload && Array.isArray(payload.biomarkers) ? payload.biomarkers : [];
}

function buildFallbackExtraction(report) {
  var payload = report && report.normalized_payload && typeof report.normalized_payload === 'object'
    ? report.normalized_payload
    : null;
  var extraction = payload && payload.extraction && typeof payload.extraction === 'object'
    ? payload.extraction
    : null;
  if (!extraction) return [];

  return [{
    id: 'lab-report-inline-extraction',
    lab_report_id: report.id,
    engine: extraction.engine || 'exam_ocr_python',
    extraction_mode: extraction.extraction_mode || report.extraction_mode || null,
    raw_text: extraction.raw_text || null,
    pages: extraction.pages || [],
    blocks: extraction.blocks || [],
    rows: extraction.rows || [],
    warnings: extraction.warnings || [],
    metadata: extraction.metadata || {},
    confidence_summary: extraction.confidence_summary || report.confidence_summary || {},
    created_at: report.processed_at || report.created_at || null
  }];
}

function normalizeStringArray(input) {
  return Array.isArray(input)
    ? input.map(function(item) { return String(item || '').trim(); }).filter(Boolean)
    : [];
}

function buildClinicalFlags(row) {
  var aiInsights = row && row.ai_insights && typeof row.ai_insights === 'object'
    ? row.ai_insights
    : null;

  return {
    clinicalFlags: normalizeStringArray((aiInsights && aiInsights.clinical_flags) || row.clinical_flags),
    criticalFlags: normalizeStringArray((aiInsights && aiInsights.critical_flags) || row.critical_flags)
  };
}

function groupRowsByReportId(rows) {
  var map = new Map();
  (Array.isArray(rows) ? rows : []).forEach(function(row) {
    var key = String(row && row.lab_report_id || '');
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function resolveReportBiomarkers(report, biomarkerMap) {
  var key = String(report && report.id || '');
  var tableRows = biomarkerMap && biomarkerMap.get(key);
  if (Array.isArray(tableRows) && tableRows.length > 0) return tableRows;
  return extractBiomarkersFromNormalizedPayload(report);
}

function resolveReportExtractions(report, extractionRows) {
  if (Array.isArray(extractionRows) && extractionRows.length > 0) return extractionRows;
  return buildFallbackExtraction(report);
}

module.exports = {
  buildClinicalFlags: buildClinicalFlags,
  buildFallbackExtraction: buildFallbackExtraction,
  extractBiomarkersFromNormalizedPayload: extractBiomarkersFromNormalizedPayload,
  groupRowsByReportId: groupRowsByReportId,
  isMissingOptionalRelation: isMissingOptionalRelation,
  normalizeStringArray: normalizeStringArray,
  resolveReportBiomarkers: resolveReportBiomarkers,
  resolveReportExtractions: resolveReportExtractions,
};
