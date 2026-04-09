var labs = require('./_utils');

module.exports = function(req, res) {
  if (labs.setApiCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  return labs.requireAuth(req, res, async function(user) {
    try {
      var body = labs.parseJsonBody(req);
      var fileName = String(body.fileName || '').trim();
      var mimeType = labs.normalizeAllowedMimeType(body.mimeType);
      var fileSize = Number(body.fileSize || 0);

      if (!fileName) return res.status(400).json({ ok: false, error: 'fileName é obrigatório.' });
      if (!labs.isAllowedMimeType(mimeType)) {
        return res.status(400).json({ ok: false, error: 'Tipo de arquivo inválido. Use PDF, JPEG ou PNG.' });
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > labs.MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({ ok: false, error: 'Arquivo inválido ou acima do limite permitido (10MB).' });
      }

      var admin = labs.createAdminSupabaseClient();
      var storagePath = labs.buildCanonicalLabStoragePath(user.id, mimeType, fileName);

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
          status: 'pending_upload',
          parse_status: 'pending',
          processing_error: null
        })
        .select('id,storage_path')
        .single();

      if (created.error || !created.data || !created.data.id) {
        return res.status(500).json({ ok: false, error: 'Falha ao registrar init-upload.' });
      }

      var signed = await admin.storage
        .from(labs.LAB_REPORTS_BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signed.error || !signed.data || !signed.data.signedUrl || !signed.data.token) {
        await admin.from('lab_reports').delete().eq('id', created.data.id);
        return res.status(500).json({ ok: false, error: 'Falha ao gerar URL assinada de upload.' });
      }

      return res.status(200).json({
        ok: true,
        labReportId: created.data.id,
        storagePath: storagePath,
        uploadUrl: signed.data.signedUrl,
        uploadToken: signed.data.token,
        expiresIn: 7200
      });
    } catch (error) {
      var reason = error && error.message ? error.message : 'unknown';
      return res.status(500).json({ ok: false, error: String(reason).slice(0, 220) });
    }
  });
};
