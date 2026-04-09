var crypto = require('crypto');
var createClient = require('@supabase/supabase-js').createClient;
var auth = require('../../apihelpers/_auth');

var LAB_REPORTS_BUCKET = 'lab-reports';
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
var SAFE_STORAGE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/;

function readSupabaseUrl() {
  return process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || '';
}

function readSupabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    || '';
}

function createAdminSupabaseClient() {
  var url = readSupabaseUrl();
  var serviceKey = readSupabaseServiceKey();
  if (!url || !serviceKey) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function parseJsonBody(req) {
  if (!req || req.body === undefined || req.body === null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); }
    catch (_) { return {}; }
  }
  return req.body;
}

function normalizeAllowedMimeType(input) {
  var raw = String(input || '').trim().toLowerCase();
  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw === 'image/x-png') return 'image/png';
  return raw;
}

function isAllowedMimeType(input) {
  return ALLOWED_MIME_TYPES.has(normalizeAllowedMimeType(input));
}

function getExtensionFromMimeOrName(mimeType, fileName) {
  var lowerName = String(fileName || '').toLowerCase();
  var normalizedMime = String(mimeType || '').toLowerCase();
  if (normalizedMime === 'application/pdf' || /\.pdf$/.test(lowerName)) return '.pdf';
  if (normalizedMime === 'image/png' || /\.png$/.test(lowerName)) return '.png';
  if (normalizedMime === 'image/jpeg' || /\.jpg$/.test(lowerName) || /\.jpeg$/.test(lowerName)) return '.jpg';
  throw new Error('Tipo de arquivo inválido. Use PDF, JPEG ou PNG.');
}

function buildCanonicalLabStoragePath(userId, mimeType, fileName) {
  return String(userId) + '/' + crypto.randomUUID() + getExtensionFromMimeOrName(mimeType, fileName);
}

function splitStoragePath(storagePath) {
  var idx = storagePath.lastIndexOf('/');
  if (idx <= 0 || idx === storagePath.length - 1) return null;
  return {
    directory: storagePath.slice(0, idx),
    fileName: storagePath.slice(idx + 1)
  };
}

async function ensureObjectExistsInStorage(admin, storagePath) {
  var parts = splitStoragePath(storagePath);
  if (!parts) return false;

  var result = await admin.storage.from(LAB_REPORTS_BUCKET).list(parts.directory, {
    limit: 100,
    search: parts.fileName
  });

  if (result.error) throw new Error('Falha ao validar objeto no storage: ' + result.error.message);
  return Boolean((result.data || []).some(function(item) { return item && item.name === parts.fileName; }));
}

function withAuth(req, res, handler) {
  return auth.requireAuth(req, res, function(user) {
    Promise.resolve(handler(user)).catch(function(error) {
      var reason = error && error.message ? error.message : 'unknown';
      return res.status(500).json({ ok: false, error: String(reason).slice(0, 220) });
    });
  });
}

function handleInitUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  return withAuth(req, res, async function(user) {
    var body = parseJsonBody(req);
    var fileName = String(body.fileName || '').trim();
    var mimeType = normalizeAllowedMimeType(body.mimeType);
    var fileSize = Number(body.fileSize || 0);

    if (!fileName) return res.status(400).json({ ok: false, error: 'fileName é obrigatório.' });
    if (!isAllowedMimeType(mimeType)) {
      return res.status(400).json({ ok: false, error: 'Tipo de arquivo inválido. Use PDF, JPEG ou PNG.' });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ ok: false, error: 'Arquivo inválido ou acima do limite permitido (10MB).' });
    }

    var admin = createAdminSupabaseClient();
    var storagePath = buildCanonicalLabStoragePath(user.id, mimeType, fileName);

    var created = await admin
      .from('lab_reports')
      .insert({
        user_id: user.id,
        storage_bucket: LAB_REPORTS_BUCKET,
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

    var signed = await admin.storage.from(LAB_REPORTS_BUCKET).createSignedUploadUrl(storagePath);
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
      expiresIn: 7200,
      bucket: LAB_REPORTS_BUCKET,
      status: 'pending_upload'
    });
  });
}

function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  return withAuth(req, res, async function(user) {
    var body = parseJsonBody(req);
    var labReportId = String(body.labReportId || '').trim();
    var storagePath = String(body.storagePath || '').trim();
    var fileName = String(body.fileName || '').trim();
    var mimeType = normalizeAllowedMimeType(body.mimeType);

    if (!labReportId || !storagePath || !fileName) {
      return res.status(400).json({ ok: false, error: 'labReportId, storagePath e fileName são obrigatórios.' });
    }
    if (!isAllowedMimeType(mimeType)) {
      return res.status(400).json({ ok: false, error: 'Tipo de arquivo inválido. Use PDF, JPEG ou PNG.' });
    }
    if (
      storagePath.indexOf('..') !== -1
      || storagePath.indexOf('//') !== -1
      || storagePath.indexOf(user.id + '/') !== 0
      || !SAFE_STORAGE_PATH_RE.test(storagePath)
    ) {
      return res.status(403).json({ ok: false, error: 'Caminho de storage inválido.' });
    }

    var admin = createAdminSupabaseClient();
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

    var storageObjectExists = await ensureObjectExistsInStorage(admin, storagePath);
    if (!storageObjectExists) {
      return res.status(409).json({ ok: false, error: 'Arquivo não encontrado no storage. Refaça o upload antes de registrar.' });
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

    return res.status(200).json({ ok: true, labReportId: updated.data.id, status: 'processing' });
  });
}

function handleReports(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  return withAuth(req, res, async function(user) {
    var limit = Math.min(Number((req.query && req.query.limit) || '10') || 10, 50);
    var admin = createAdminSupabaseClient();

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
  });
}

function handleReportById(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  return withAuth(req, res, async function(user) {
    var id = String((req.query && req.query.id) || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório.' });

    var admin = createAdminSupabaseClient();
    var reportResult = await admin
      .from('lab_reports')
      .select('id,file_name,mime_type,file_type,status,parse_status,extraction_mode,source_type,confidence_summary,normalized_payload,ai_insights,is_valid,processing_error,created_at,processed_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (reportResult.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar exame.' });
    if (!reportResult.data) return res.status(404).json({ ok: false, error: 'Exame não encontrado.' });

    var extractions = await admin
      .from('lab_report_extractions')
      .select('id,lab_report_id,extraction_mode,confidence,raw_output,structured_data,created_at')
      .eq('lab_report_id', id)
      .order('created_at', { ascending: false });

    if (extractions.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar extrações.' });

    var biomarkers = await admin
      .from('lab_report_biomarkers')
      .select('lab_report_id,marker_key,marker_name,value_numeric,value_text,unit,reference_min,reference_max,flag,confidence,created_at')
      .eq('lab_report_id', id)
      .order('created_at', { ascending: true });

    if (biomarkers.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar biomarcadores.' });

    return res.status(200).json({
      ok: true,
      report: reportResult.data,
      extractions: extractions.data || [],
      biomarkers: biomarkers.data || []
    });
  });
}

module.exports = {
  handleInitUpload: handleInitUpload,
  handleRegister: handleRegister,
  handleReports: handleReports,
  handleReportById: handleReportById,
  buildCanonicalLabStoragePath: buildCanonicalLabStoragePath,
  getExtensionFromMimeOrName: getExtensionFromMimeOrName,
  SAFE_STORAGE_PATH_RE: SAFE_STORAGE_PATH_RE,
  MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_BYTES
};
