var crypto = require('crypto');
var auth = require('../../apihelpers/_auth');

var LAB_REPORTS_BUCKET = 'lab-reports';
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
var SAFE_STORAGE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/;

function readSupabaseUrl() {
  return (process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || '').replace(/\/$/, '');
}

function readSupabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    || '';
}

// --- Native fetch helpers for Supabase REST (PostgREST) ---

async function restRequest(baseUrl, serviceKey, method, table, queryString, body) {
  var url = baseUrl + '/rest/v1/' + table + (queryString ? '?' + queryString : '');
  var res = await fetch(url, {
    method: method,
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  var text = await res.text();
  if (!res.ok) {
    var errData;
    try { errData = JSON.parse(text); } catch (e) { errData = { message: text }; }
    return { data: null, error: { message: errData.message || text, code: String(res.status), details: errData.details, hint: errData.hint } };
  }
  var parsed;
  try { parsed = JSON.parse(text); } catch (e) { parsed = []; }
  return { data: parsed, error: null };
}

// Equivalent to .insert(body).select(cols).single()
async function dbInsert(baseUrl, serviceKey, table, body, selectCols) {
  var qs = selectCols ? 'select=' + encodeURIComponent(selectCols) : '';
  var result = await restRequest(baseUrl, serviceKey, 'POST', table, qs, body);
  if (result.error) return result;
  var rows = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
  if (rows.length === 0) return { data: null, error: { message: 'sem dados retornados', code: 'PGRST116' } };
  return { data: rows[0], error: null };
}

// Equivalent to .delete().eq(col, val)
async function dbDelete(baseUrl, serviceKey, table, filters) {
  var parts = [];
  Object.keys(filters).forEach(function(k) {
    parts.push(encodeURIComponent(k) + '=eq.' + encodeURIComponent(String(filters[k])));
  });
  return restRequest(baseUrl, serviceKey, 'DELETE', table, parts.join('&'), undefined);
}

// Equivalent to .update(body).eq(...).select(cols).single()
async function dbUpdate(baseUrl, serviceKey, table, filters, body, selectCols) {
  var parts = [];
  Object.keys(filters).forEach(function(k) {
    parts.push(encodeURIComponent(k) + '=eq.' + encodeURIComponent(String(filters[k])));
  });
  if (selectCols) parts.push('select=' + encodeURIComponent(selectCols));
  var result = await restRequest(baseUrl, serviceKey, 'PATCH', table, parts.join('&'), body);
  if (result.error) return result;
  var rows = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
  if (rows.length === 0) return { data: null, error: { message: 'sem dados retornados', code: 'PGRST116' } };
  return { data: rows[0], error: null };
}

// Equivalent to .select(cols).eq(...).maybeSingle()
async function dbSelectOne(baseUrl, serviceKey, table, filters, selectCols) {
  var parts = [];
  if (selectCols) parts.push('select=' + encodeURIComponent(selectCols));
  Object.keys(filters).forEach(function(k) {
    parts.push(encodeURIComponent(k) + '=eq.' + encodeURIComponent(String(filters[k])));
  });
  parts.push('limit=1');
  var result = await restRequest(baseUrl, serviceKey, 'GET', table, parts.join('&'), undefined);
  if (result.error) return result;
  var rows = Array.isArray(result.data) ? result.data : [];
  return { data: rows.length > 0 ? rows[0] : null, error: null };
}

// Equivalent to .select(cols).eq(...).order(...).limit(n)
async function dbSelectMany(baseUrl, serviceKey, table, eqFilters, inFilters, selectCols, orderCol, orderAsc, limitN) {
  var parts = [];
  if (selectCols) parts.push('select=' + encodeURIComponent(selectCols));
  if (eqFilters) {
    Object.keys(eqFilters).forEach(function(k) {
      parts.push(encodeURIComponent(k) + '=eq.' + encodeURIComponent(String(eqFilters[k])));
    });
  }
  if (inFilters) {
    Object.keys(inFilters).forEach(function(k) {
      var vals = inFilters[k].map(function(v) { return encodeURIComponent(String(v)); });
      parts.push(encodeURIComponent(k) + '=in.(' + vals.join(',') + ')');
    });
  }
  if (orderCol) parts.push('order=' + orderCol + '.' + (orderAsc ? 'asc' : 'desc'));
  if (limitN) parts.push('limit=' + limitN);
  return restRequest(baseUrl, serviceKey, 'GET', table, parts.join('&'), undefined);
}

// --- Native fetch helpers for Supabase Storage ---

async function storageRequest(baseUrl, serviceKey, method, path, body) {
  var url = baseUrl + '/storage/v1/' + path;
  var res = await fetch(url, {
    method: method,
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  var text = await res.text();
  if (!res.ok) {
    var errData;
    try { errData = JSON.parse(text); } catch (e) { errData = { message: text }; }
    return { data: null, error: { message: errData.message || text, statusCode: String(res.status), details: errData } };
  }
  var parsed;
  try { parsed = JSON.parse(text); } catch (e) { return { data: null, error: { message: 'resposta inválida do Storage', statusCode: String(res.status) } }; }
  return { data: parsed, error: null };
}

// Equivalent to admin.storage.from(bucket).createSignedUploadUrl(path)
async function storageCreateSignedUploadUrl(baseUrl, serviceKey, bucket, storagePath) {
  var apiPath = 'object/upload/sign/' + encodeURIComponent(bucket) + '/' + storagePath;
  var result = await storageRequest(baseUrl, serviceKey, 'POST', apiPath, {});
  if (result.error) return result;
  var raw = result.data;
  if (!raw || !raw.signedURL || !raw.token) {
    return { data: null, error: { message: 'resposta incompleta da Storage API', statusCode: '200', details: raw } };
  }
  return { data: { signedUrl: raw.signedURL, token: raw.token, path: raw.path || storagePath }, error: null };
}

// Equivalent to admin.storage.from(bucket).list(directory, {limit, search})
async function storageList(baseUrl, serviceKey, bucket, directory, limit, search) {
  var apiPath = 'object/list/' + encodeURIComponent(bucket);
  var body = { prefix: directory, limit: limit || 100, offset: 0, sortBy: { column: 'name', order: 'asc' } };
  if (search) body.search = search;
  var result = await storageRequest(baseUrl, serviceKey, 'POST', apiPath, body);
  if (result.error) return result;
  return { data: Array.isArray(result.data) ? result.data : [], error: null };
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

async function ensureObjectExistsInStorage(baseUrl, serviceKey, storagePath) {
  var parts = splitStoragePath(storagePath);
  if (!parts) return false;

  var delays = [0, 800, 1600];
  for (var i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(function(r) { setTimeout(r, delays[i]); });
    var result = await storageList(baseUrl, serviceKey, LAB_REPORTS_BUCKET, parts.directory, 100, parts.fileName);
    if (result.error) throw new Error('Falha ao validar objeto no storage: ' + result.error.message);
    if ((result.data || []).some(function(item) { return item && item.name === parts.fileName; })) return true;
  }
  return false;
}

function withAuth(req, res, handler) {
  return auth.requireAuth(req, res, function(user) {
    Promise.resolve(handler(user)).catch(function(error) {
      console.error('[labs/fatal] uncaught exception:', {
        message: error && error.message,
        stack: error && error.stack ? String(error.stack).slice(0, 600) : undefined
      });
      var reason = error && error.message ? error.message : 'unknown';
      return res.status(500).json({ ok: false, error: String(reason).slice(0, 500), code: 'INTERNAL_ERROR' });
    });
  });
}

// ---------------------------------------------------------------------------
// POST /api/kronia/labs/init-upload
// Creates a pending lab_reports row and returns a signed upload URL.
// ---------------------------------------------------------------------------
function handleInitUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  console.log('[labs/init-upload] start', { method: req.method });

  return withAuth(req, res, async function(user) {
    console.log('[labs/init-upload] auth', { userId: user.id });

    var body = parseJsonBody(req);
    var fileName = String(body.fileName || '').trim();
    var mimeType = normalizeAllowedMimeType(body.mimeType);
    var fileSize = Number(body.fileSize || 0);

    console.log('[labs/init-upload] payload', {
      bodyKeys: Object.keys(body),
      fileName: fileName,
      mimeType: mimeType,
      fileSize: fileSize,
      userId: user.id
    });

    if (!fileName) return res.status(400).json({ ok: false, error: 'fileName é obrigatório.' });
    if (!isAllowedMimeType(mimeType)) {
      return res.status(400).json({ ok: false, error: 'Tipo de arquivo inválido. Use PDF, JPEG ou PNG.' });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ ok: false, error: 'Arquivo inválido ou acima do limite permitido (10MB).' });
    }

    var baseUrl = readSupabaseUrl();
    var serviceKey = readSupabaseServiceKey();
    if (!baseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.', code: 'CONFIG_ERROR' });
    }

    var storagePath = buildCanonicalLabStoragePath(user.id, mimeType, fileName);

    console.log('[labs/init-upload] storage', {
      bucket: LAB_REPORTS_BUCKET,
      storagePath: storagePath
    });

    // Insert pending record
    var insertPayload = {
      user_id: user.id,
      storage_bucket: LAB_REPORTS_BUCKET,
      storage_path: storagePath,
      file_url: storagePath,
      file_name: fileName,
      file_type: mimeType,
      mime_type: mimeType,
      status: 'pending_upload',
      parse_status: 'pending_upload',
      processing_error: null
    };
    console.log('[labs/init-upload] insert-payload', insertPayload);

    var created = await dbInsert(baseUrl, serviceKey, 'lab_reports', insertPayload, 'id,storage_path');

    console.log('[labs/init-upload] insert-result', {
      hasData: !!created.data,
      id: created.data && created.data.id,
      hasError: !!created.error,
      errorMessage: created.error && created.error.message,
      errorCode: created.error && created.error.code,
      errorDetails: created.error && created.error.details,
      errorHint: created.error && created.error.hint
    });

    if (created.error || !created.data || !created.data.id) {
      var dbErr = created.error
        ? String(created.error.message || created.error.code || JSON.stringify(created.error)).slice(0, 300)
        : 'sem dados retornados';
      console.error('[labs/init-upload] insert-result ERROR:', dbErr);
      return res.status(500).json({
        ok: false,
        error: 'Falha ao registrar init-upload: ' + dbErr,
        code: 'DB_INSERT_ERROR',
        details: created.error ? {
          message: created.error.message,
          code: created.error.code,
          details: created.error.details,
          hint: created.error.hint
        } : null
      });
    }

    // Generate signed upload URL
    var signed = await storageCreateSignedUploadUrl(baseUrl, serviceKey, LAB_REPORTS_BUCKET, storagePath);

    console.log('[labs/init-upload] signed-result', {
      hasData: !!signed.data,
      hasSignedUrl: !!(signed.data && signed.data.signedUrl),
      hasToken: !!(signed.data && signed.data.token),
      hasError: !!signed.error,
      errorMessage: signed.error && signed.error.message,
      errorCode: signed.error && signed.error.statusCode,
      errorDetails: signed.error && signed.error.details
    });

    if (signed.error || !signed.data || !signed.data.signedUrl || !signed.data.token) {
      var storErr = signed.error
        ? String(signed.error.message || signed.error.statusCode || JSON.stringify(signed.error)).slice(0, 300)
        : 'resposta incompleta da Storage API';
      console.error('[labs/init-upload] signed-result ERROR:', storErr);
      await dbDelete(baseUrl, serviceKey, 'lab_reports', { id: created.data.id });
      return res.status(500).json({
        ok: false,
        error: 'Falha ao gerar URL assinada: ' + storErr,
        code: 'STORAGE_SIGNED_URL_ERROR',
        details: signed.error ? {
          message: signed.error.message,
          statusCode: signed.error.statusCode,
          details: signed.error.details
        } : null
      });
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

// ---------------------------------------------------------------------------
// POST /api/kronia/labs/register
// Confirms the file was uploaded to Storage and marks it ready for processing.
// ---------------------------------------------------------------------------
function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  console.log('[labs/register] start', { method: req.method });

  return withAuth(req, res, async function(user) {
    console.log('[labs/register] auth', { userId: user.id });

    var body = parseJsonBody(req);
    var labReportId = String(body.labReportId || '').trim();
    var storagePath = String(body.storagePath || '').trim();
    var fileName = String(body.fileName || '').trim();
    var mimeType = normalizeAllowedMimeType(body.mimeType);

    console.log('[labs/register] payload', {
      bodyKeys: Object.keys(body),
      labReportId: labReportId,
      storagePath: storagePath,
      fileName: fileName,
      mimeType: mimeType,
      userId: user.id
    });

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

    var baseUrl = readSupabaseUrl();
    var serviceKey = readSupabaseServiceKey();
    if (!baseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.', code: 'CONFIG_ERROR' });
    }

    var existing = await dbSelectOne(baseUrl, serviceKey, 'lab_reports', { id: labReportId, user_id: user.id }, 'id,user_id,storage_path,status');

    if (existing.error) return res.status(500).json({ ok: false, error: 'Erro ao validar labReportId.' });
    if (!existing.data) return res.status(404).json({ ok: false, error: 'Lab report não encontrado para este usuário.' });
    if (String(existing.data.storage_path || '') !== storagePath) {
      return res.status(409).json({ ok: false, error: 'labReportId não corresponde ao storagePath informado.' });
    }

    var storageObjectExists = await ensureObjectExistsInStorage(baseUrl, serviceKey, storagePath);
    if (!storageObjectExists) {
      return res.status(409).json({ ok: false, error: 'Arquivo não encontrado no storage. Refaça o upload antes de registrar.' });
    }

    var updatePayload = {
      file_name: fileName,
      file_type: mimeType,
      mime_type: mimeType,
      status: 'uploaded',
      parse_status: 'uploaded',
      processing_error: null
    };
    console.log('[labs/register] insert-payload', updatePayload);

    var updated = await dbUpdate(baseUrl, serviceKey, 'lab_reports', { id: labReportId, user_id: user.id }, updatePayload, 'id');

    console.log('[labs/register] insert-result', {
      hasData: !!updated.data,
      id: updated.data && updated.data.id,
      hasError: !!updated.error,
      errorMessage: updated.error && updated.error.message,
      errorCode: updated.error && updated.error.code,
      errorDetails: updated.error && updated.error.details,
      errorHint: updated.error && updated.error.hint
    });

    if (updated.error || !updated.data || !updated.data.id) {
      var updErr = updated.error
        ? String(updated.error.message || updated.error.code || JSON.stringify(updated.error)).slice(0, 300)
        : 'sem dados retornados';
      console.error('[labs/register] insert-result ERROR:', updErr);
      return res.status(500).json({
        ok: false,
        error: 'Falha ao atualizar registro do exame: ' + updErr,
        code: 'DB_UPDATE_ERROR',
        details: updated.error ? {
          message: updated.error.message,
          code: updated.error.code,
          details: updated.error.details,
          hint: updated.error.hint
        } : null
      });
    }

    return res.status(200).json({ ok: true, labReportId: updated.data.id, status: 'processing' });
  });
}

function handleReports(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  return withAuth(req, res, async function(user) {
    var limit = Math.min(Number((req.query && req.query.limit) || '10') || 10, 50);

    var baseUrl = readSupabaseUrl();
    var serviceKey = readSupabaseServiceKey();
    if (!baseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.', code: 'CONFIG_ERROR' });
    }

    var reportsResult = await dbSelectMany(
      baseUrl, serviceKey,
      'lab_reports',
      { user_id: user.id },
      null,
      'id,file_name,mime_type,file_type,status,parse_status,extraction_mode,source_type,confidence_summary,normalized_payload,ai_insights,is_valid,processing_error,created_at,processed_at',
      'created_at',
      false,
      limit
    );

    if (reportsResult.error) {
      return res.status(500).json({ ok: false, error: 'Erro ao buscar histórico de exames.' });
    }

    var rows = Array.isArray(reportsResult.data) ? reportsResult.data : [];
    var ids = rows.map(function(row) { return row.id; }).filter(Boolean);
    var biomarkerMap = new Map();

    if (ids.length > 0) {
      var biomarkersResult = await dbSelectMany(
        baseUrl, serviceKey,
        'lab_report_biomarkers',
        null,
        { lab_report_id: ids },
        'lab_report_id,marker_key,marker_name,value_numeric,value_text,unit,reference_min,reference_max,flag,confidence,created_at',
        'created_at',
        true,
        null
      );

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

    var baseUrl = readSupabaseUrl();
    var serviceKey = readSupabaseServiceKey();
    if (!baseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.', code: 'CONFIG_ERROR' });
    }

    var reportResult = await dbSelectOne(
      baseUrl, serviceKey,
      'lab_reports',
      { id: id, user_id: user.id },
      'id,file_name,mime_type,file_type,status,parse_status,extraction_mode,source_type,confidence_summary,normalized_payload,ai_insights,is_valid,processing_error,created_at,processed_at'
    );

    if (reportResult.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar exame.' });
    if (!reportResult.data) return res.status(404).json({ ok: false, error: 'Exame não encontrado.' });

    var extractions = await dbSelectMany(
      baseUrl, serviceKey,
      'lab_report_extractions',
      { lab_report_id: id },
      null,
      'id,lab_report_id,extraction_mode,confidence,raw_output,structured_data,created_at',
      'created_at',
      false,
      null
    );

    if (extractions.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar extrações.' });

    var biomarkers = await dbSelectMany(
      baseUrl, serviceKey,
      'lab_report_biomarkers',
      { lab_report_id: id },
      null,
      'lab_report_id,marker_key,marker_name,value_numeric,value_text,unit,reference_min,reference_max,flag,confidence,created_at',
      'created_at',
      true,
      null
    );

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
