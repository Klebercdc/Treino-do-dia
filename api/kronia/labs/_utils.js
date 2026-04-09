var crypto = require('crypto');
var cors = require('../../../src/server/apihelpers/_cors');
var auth = require('../../../src/server/apihelpers/_auth');
var createClient = require('@supabase/supabase-js').createClient;

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
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function setApiCors(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

function parseJsonBody(req) {
  if (!req || req.body === undefined || req.body === null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); }
    catch (_) { return {}; }
  }
  return req.body;
}

function getExtensionFromMimeOrName(mimeType, fileName) {
  var lowerName = String(fileName || '').toLowerCase();
  var normalizedMime = String(mimeType || '').toLowerCase();
  if (normalizedMime === 'application/pdf' || /\.pdf$/.test(lowerName)) return '.pdf';
  if (normalizedMime === 'image/png' || /\.png$/.test(lowerName)) return '.png';
  return '.jpg';
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

function normalizeAllowedMimeType(input) {
  var raw = String(input || '').trim().toLowerCase();
  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw === 'image/x-png') return 'image/png';
  return raw;
}

function isAllowedMimeType(input) {
  return ALLOWED_MIME_TYPES.has(normalizeAllowedMimeType(input));
}

module.exports = {
  LAB_REPORTS_BUCKET: LAB_REPORTS_BUCKET,
  MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_BYTES,
  SAFE_STORAGE_PATH_RE: SAFE_STORAGE_PATH_RE,
  createAdminSupabaseClient: createAdminSupabaseClient,
  setApiCors: setApiCors,
  parseJsonBody: parseJsonBody,
  buildCanonicalLabStoragePath: buildCanonicalLabStoragePath,
  getExtensionFromMimeOrName: getExtensionFromMimeOrName,
  ensureObjectExistsInStorage: ensureObjectExistsInStorage,
  normalizeAllowedMimeType: normalizeAllowedMimeType,
  isAllowedMimeType: isAllowedMimeType,
  requireAuth: auth.requireAuth
};
