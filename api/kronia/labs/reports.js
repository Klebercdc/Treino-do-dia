var labs = require('./_utils');

module.exports = function(req, res) {
  if (labs.setApiCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  return labs.requireAuth(req, res, async function(user) {
    try {
      var limit = Math.min(Number((req.query && req.query.limit) || '10') || 10, 50);
      var admin = labs.createAdminSupabaseClient();

      var reportsResult = await admin
        .from('lab_reports')
        .select('id,file_name,mime_type,file_type,status,parse_status,extraction_mode,source_type,confidence_summary,normalized_payload,ai_insights,is_valid,processing_error,created_at,processed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (reportsResult.error) {
        return res.status(500).json({ ok: false, error: 'Erro ao buscar histórico de exames.' });
      }

      var rows = reportsResult.data || [];
      var ids = rows.map(function(row) { return row.id; }).filter(Boolean);
      var biomarkerMap = new Map();

      if (ids.length > 0) {
        var biomarkersResult = await admin
          .from('lab_report_biomarkers')
          .select('lab_report_id,marker_key,marker_name,value_numeric,value_text,unit,reference_min,reference_max,flag,confidence,created_at')
          .in('lab_report_id', ids)
          .order('created_at', { ascending: true });

        if (!biomarkersResult.error && Array.isArray(biomarkersResult.data)) {
          biomarkersResult.data.forEach(function(row) {
            var key = String(row.lab_report_id);
            if (!biomarkerMap.has(key)) biomarkerMap.set(key, []);
            biomarkerMap.get(key).push(row);
          });
        }
      }

      var reports = rows.map(function(row) {
        return {
          id: row.id,
          fileName: row.file_name,
          fileType: row.mime_type || row.file_type,
          status: row.status || row.parse_status,
          parseStatus: row.parse_status,
          extractionMode: row.extraction_mode,
          sourceType: row.source_type,
          confidenceSummary: row.confidence_summary || {},
          normalizedPayload: row.normalized_payload || null,
          aiInsights: row.ai_insights || null,
          isValid: row.is_valid,
          processingError: row.processing_error,
          biomarkers: biomarkerMap.get(String(row.id)) || [],
          clinicalFlags: [],
          createdAt: row.created_at,
          processedAt: row.processed_at
        };
      });

      return res.status(200).json({ ok: true, reports: reports, total: reports.length });
    } catch (error) {
      var reason = error && error.message ? error.message : 'unknown';
      return res.status(500).json({ ok: false, error: String(reason).slice(0, 220) });
    }
  });
};
