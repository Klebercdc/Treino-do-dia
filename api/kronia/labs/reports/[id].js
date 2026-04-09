var labs = require('../_utils');

module.exports = function(req, res) {
  if (labs.setApiCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  return labs.requireAuth(req, res, async function(user) {
    try {
      var id = String((req.query && req.query.id) || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório.' });

      var admin = labs.createAdminSupabaseClient();
      var reportResult = await admin
        .from('lab_reports')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (reportResult.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar exame.' });
      if (!reportResult.data) return res.status(404).json({ ok: false, error: 'Exame não encontrado.' });

      var extractions = await admin
        .from('lab_report_extractions')
        .select('*')
        .eq('lab_report_id', id)
        .order('created_at', { ascending: false });

      if (extractions.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar extrações.' });

      var biomarkers = await admin
        .from('lab_report_biomarkers')
        .select('*')
        .eq('lab_report_id', id)
        .order('created_at', { ascending: true });

      if (biomarkers.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar biomarcadores.' });

      return res.status(200).json({
        ok: true,
        report: reportResult.data,
        extractions: extractions.data || [],
        biomarkers: biomarkers.data || []
      });
    } catch (error) {
      var reason = error && error.message ? error.message : 'unknown';
      return res.status(500).json({ ok: false, error: String(reason).slice(0, 220) });
    }
  });
};
