var labs = require('./_utils');

module.exports = function(req, res) {
  if (labs.setApiCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  return labs.requireAuth(req, res, async function(user) {
    try {
      var body = labs.parseJsonBody(req);
      var labReportId = String(body.labReportId || '').trim();
      var storagePath = String(body.storagePath || '').trim();
      var fileName = String(body.fileName || '').trim();
      var mimeType = labs.normalizeAllowedMimeType(body.mimeType);

      if (!storagePath || !fileName) {
        return res.status(400).json({ ok: false, error: 'storagePath e fileName são obrigatórios.' });
      }
      if (!labs.isAllowedMimeType(mimeType)) {
        return res.status(400).json({ ok: false, error: 'Tipo de arquivo inválido. Use PDF, JPEG ou PNG.' });
      }

      if (
        storagePath.indexOf('..') !== -1
        || storagePath.indexOf('//') !== -1
        || storagePath.indexOf(user.id + '/') !== 0
        || !labs.SAFE_STORAGE_PATH_RE.test(storagePath)
      ) {
        return res.status(403).json({ ok: false, error: 'Caminho de storage inválido.' });
      }

      var admin = labs.createAdminSupabaseClient();
      var storageObjectExists = await labs.ensureObjectExistsInStorage(admin, storagePath);
      if (!storageObjectExists) {
        return res.status(409).json({ ok: false, error: 'Arquivo não encontrado no storage. Refaça o upload antes de registrar.' });
      }

      var persistedId = labReportId;
      if (labReportId) {
        var existing = await admin
          .from('lab_reports')
          .select('id,user_id,storage_path,status')
          .eq('id', labReportId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing.error) return res.status(500).json({ ok: false, error: 'Erro ao validar labReportId.' });
        if (!existing.data) return res.status(404).json({ ok: false, error: 'Lab report não encontrado para este usuário.' });
        if (String(existing.data.storage_path || '') !== storagePath) {
          return res.status(409).json({ ok: false, error: 'labReportId não corresponde ao storagePath informado.' });
        }

        var updated = await admin
          .from('lab_reports')
          .update({
            file_name: fileName,
            file_type: mimeType,
            mime_type: mimeType,
            status: 'uploaded',
            parse_status: 'pending',
            processing_error: null
          })
          .eq('id', labReportId)
          .eq('user_id', user.id)
          .select('id')
          .single();

        if (updated.error || !updated.data || !updated.data.id) {
          return res.status(500).json({ ok: false, error: 'Falha ao atualizar registro do exame.' });
        }
      } else {
        var created = await admin
          .from('lab_reports')
          .insert({
            user_id: user.id,
            storage_bucket: labs.LAB_REPORTS_BUCKET,
            storage_path: storagePath,
            file_url: storagePath,
            file_name: fileName,
            file_type: mimeType,
            mime_type: mimeType,
            status: 'uploaded',
            parse_status: 'pending',
            processing_error: null
          })
          .select('id')
          .single();

        if (created.error || !created.data || !created.data.id) {
          return res.status(500).json({ ok: false, error: 'Falha ao criar registro do exame.' });
        }
        persistedId = created.data.id;
      }

      return res.status(200).json({ ok: true, labReportId: persistedId, status: 'processing' });
    } catch (error) {
      var reason = error && error.message ? error.message : 'unknown';
      return res.status(500).json({ ok: false, error: String(reason).slice(0, 220) });
    }
  });
};
