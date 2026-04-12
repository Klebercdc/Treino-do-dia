var crypto = require('crypto');
var createClient = require('@supabase/supabase-js').createClient;
var auth = require('../src/server/apihelpers/_auth');
var labReadModel = require('../src/server/internal/labReports/readModel');

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

  var delays = [0, 800, 1600];
  for (var i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(function(r) { setTimeout(r, delays[i]); });
    var result = await admin.storage.from(LAB_REPORTS_BUCKET).list(parts.directory, {
      limit: 100,
      search: parts.fileName
    });
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

var isMissingOptionalTable = labReadModel.isMissingOptionalRelation;
var extractBiomarkersFromNormalizedPayload = labReadModel.extractBiomarkersFromNormalizedPayload;
var normalizeStringArray = labReadModel.normalizeStringArray;
var buildClinicalFlags = labReadModel.buildClinicalFlags;
var buildFallbackExtraction = labReadModel.buildFallbackExtraction;
var groupRowsByReportId = labReadModel.groupRowsByReportId;
var resolveReportBiomarkers = labReadModel.resolveReportBiomarkers;
var resolveReportExtractions = labReadModel.resolveReportExtractions;

function shapeReportSummary(row, biomarkers) {
  var flags = buildClinicalFlags(row);
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
    biomarkers: biomarkers || [],
    clinicalFlags: flags.clinicalFlags,
    criticalFlags: flags.criticalFlags,
    createdAt: row.created_at,
    processedAt: row.processed_at
  };
}

function isDeletionBlockedStatus(statusKey) {
  return statusKey === 'pending_upload'
    || statusKey === 'uploaded'
    || statusKey === 'queued'
    || statusKey === 'processing'
    || statusKey === 'extracted';
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

    var admin = createAdminSupabaseClient();
    var storagePath = buildCanonicalLabStoragePath(user.id, mimeType, fileName);

    // Validate SDK capability before touching the DB
    var bucketHandle = admin.storage.from(LAB_REPORTS_BUCKET);
    console.log('[labs/init-upload] storage', {
      bucket: LAB_REPORTS_BUCKET,
      storagePath: storagePath,
      createSignedUploadUrlType: typeof bucketHandle.createSignedUploadUrl
    });
    if (typeof bucketHandle.createSignedUploadUrl !== 'function') {
      console.error('[labs/init-upload] storage', { error: 'createSignedUploadUrl indisponível no SDK instalado' });
      return res.status(500).json({
        ok: false,
        error: 'SDK incompatível: createSignedUploadUrl indisponível',
        code: 'SDK_INCOMPATIBLE'
      });
    }

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
      parse_status: 'pending_upload',  // FIX: was 'pending' — invalid per lab_reports_parse_status_check
      processing_error: null
    };
    console.log('[labs/init-upload] insert-payload', insertPayload);

    var created = await admin
      .from('lab_reports')
      .insert(insertPayload)
      .select('id,storage_path')
      .single();

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
    var signed = await bucketHandle.createSignedUploadUrl(storagePath);

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
      await admin.from('lab_reports').delete().eq('id', created.data.id);
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

    var updatePayload = {
      file_name: fileName,
      file_type: mimeType,
      mime_type: mimeType,
      status: 'uploaded',
      parse_status: 'uploaded',  // FIX: was 'pending' — invalid per lab_reports_parse_status_check
      processing_error: null
    };
    console.log('[labs/register] insert-payload', updatePayload);

    var updated = await admin
      .from('lab_reports')
      .update(updatePayload)
      .eq('id', labReportId)
      .eq('user_id', user.id)
      .select('id')
      .single();

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

    // Camada 1: disparo direto para a Edge Function via HTTP (não depende de pg_net/vault).
    // O DB trigger (trg_lab_reports_dispatch_uploaded) e o watchdog pg_cron são backups.
    var edgeUrl = readSupabaseUrl().replace(/\/$/, '') + '/functions/v1/lab-report-orchestrator';
    var edgeKey = readSupabaseServiceKey();
    if (edgeUrl && edgeKey) {
      fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + edgeKey,
        },
        body: JSON.stringify({
          labReportId: updated.data.id,
          dispatchSource: 'register_direct_dispatch',
        }),
      }).catch(function(edgeErr) {
        console.warn('[labs/register] direct edge dispatch failed (non-blocking):', edgeErr && edgeErr.message);
      });
      console.log('[labs/register] direct edge dispatch initiated', { labReportId: updated.data.id });
    } else {
      console.warn('[labs/register] direct edge dispatch skipped: missing supabase url or service key');
    }

    // Camada 2: RPC do BD cria audit trail em pipeline_events e dispara via pg_net.
    admin.rpc('dispatch_lab_report_to_edge', {
      p_lab_report_id: labReportId,
      p_source: 'api_register_uploaded',
      p_expected_updated_at: null
    }).then(function(dispatch) {
      if (dispatch.error) {
        console.warn('[labs/register] dispatch rpc failed (non-blocking)', {
          labReportId: labReportId,
          errorMessage: dispatch.error.message,
          errorCode: dispatch.error.code,
        });
      }
    }).catch(function(rpcErr) {
      console.warn('[labs/register] dispatch rpc exception (non-blocking):', rpcErr && rpcErr.message);
    });

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
      console.error('[labs/reports] erro ao buscar reports:', {
        code: reportsResult.error.code,
        message: String(reportsResult.error.message || '').slice(0, 300)
      });
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
        biomarkerMap = groupRowsByReportId(biomarkersResult.data);
        rows.forEach(function(row) {
          if (!biomarkerMap.has(String(row.id))) {
            var fallback = extractBiomarkersFromNormalizedPayload(row);
            if (fallback.length > 0) biomarkerMap.set(String(row.id), fallback);
          }
        });
      } else {
        if (biomarkersResult.error && !isMissingOptionalTable(biomarkersResult.error, 'lab_report_biomarkers')) {
          console.error('[labs/reports] erro ao buscar biomarcadores:', {
            code: biomarkersResult.error.code,
            message: String(biomarkersResult.error.message || '').slice(0, 200)
          });
        }
        rows.forEach(function(row) {
          biomarkerMap.set(String(row.id), extractBiomarkersFromNormalizedPayload(row));
        });
      }
    }

    var reports = rows.map(function(row) {
      return shapeReportSummary(row, resolveReportBiomarkers(row, biomarkerMap));
    });

    return res.status(200).json({ ok: true, reports: reports, total: reports.length });
  });
}

function handleReportById(req, res) {
  return withAuth(req, res, async function(user) {
    var id = String((req.query && req.query.id) || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório.' });

    var admin = createAdminSupabaseClient();
    var reportResult = await admin
      .from('lab_reports')
      .select('id,file_name,mime_type,file_type,status,parse_status,extraction_mode,source_type,confidence_summary,normalized_payload,ai_insights,is_valid,processing_error,storage_bucket,storage_path,created_at,processed_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (reportResult.error) return res.status(500).json({ ok: false, error: 'Erro ao consultar exame.' });
    if (!reportResult.data) return res.status(404).json({ ok: false, error: 'Exame não encontrado.' });

    if (req.method === 'DELETE') {
      var statusKey = String(reportResult.data.status || reportResult.data.parse_status || '').toLowerCase();
      if (isDeletionBlockedStatus(statusKey)) {
        return res.status(409).json({
          ok: false,
          error: 'Este exame ainda está em processamento e não pode ser excluído agora.',
          code: 'REPORT_STILL_PROCESSING'
        });
      }

      var deleteResult = await admin
        .from('lab_reports')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteResult.error) {
        return res.status(500).json({
          ok: false,
          error: 'Falha ao remover exame.',
          code: 'DB_DELETE_ERROR'
        });
      }

      var storageBucket = String(reportResult.data.storage_bucket || LAB_REPORTS_BUCKET);
      var storagePath = String(reportResult.data.storage_path || '').trim();
      if (storagePath) {
        var removal = await admin.storage.from(storageBucket).remove([storagePath]);
        if (removal.error) {
          console.warn('[labs/delete] storage cleanup failed after db delete', {
            reportId: id,
            storageBucket: storageBucket,
            storagePath: storagePath,
            error: removal.error.message || removal.error
          });
        }
      }

      return res.status(200).json({ ok: true, deletedId: id });
    }

    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

    var extractions = await admin
      .from('lab_report_extractions')
      .select('id,lab_report_id,engine,extraction_mode,raw_text,pages,blocks,rows,warnings,metadata,confidence_summary,created_at')
      .eq('lab_report_id', id)
      .order('created_at', { ascending: false });

    if (extractions.error && !isMissingOptionalTable(extractions.error, 'lab_report_extractions')) {
      return res.status(500).json({ ok: false, error: 'Erro ao consultar extrações.' });
    }

    var biomarkers = await admin
      .from('lab_report_biomarkers')
      .select('lab_report_id,marker_key,marker_name,value_numeric,value_text,unit,reference_min,reference_max,flag,confidence,created_at')
      .eq('lab_report_id', id)
      .order('created_at', { ascending: true });

    if (biomarkers.error && !isMissingOptionalTable(biomarkers.error, 'lab_report_biomarkers')) {
      return res.status(500).json({ ok: false, error: 'Erro ao consultar biomarcadores.' });
    }

    var resolvedExtractions = resolveReportExtractions(reportResult.data, extractions.data);
    var resolvedBiomarkers = resolveReportBiomarkers(reportResult.data, groupRowsByReportId(biomarkers.data));

    return res.status(200).json({
      ok: true,
      report: shapeReportSummary(reportResult.data, resolvedBiomarkers),
      extractions: resolvedExtractions,
      biomarkers: resolvedBiomarkers
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
