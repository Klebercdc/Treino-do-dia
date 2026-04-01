var exerciseImport = require('../src/server/internal/exerciseImport');
var supabaseJs = require('@supabase/supabase-js');

var IMPORT_LOCK_KEY = 948221;

function parseBoolean(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].indexOf(value.toLowerCase()) >= 0;
}

function parsePositiveInt(value) {
  if (value == null || value === '') {
    return null;
  }
  var parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function createSupabaseAdminClient() {
  var env = exerciseImport.validateRequiredEnv();
  return supabaseJs.createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false }
  });
}

function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];

  if (!expected) {
    return { ok: false, reason: 'IMPORT_ADMIN_KEY não configurada no ambiente.' };
  }

  if (!provided || provided !== expected) {
    return { ok: false, reason: 'x-admin-key inválido.' };
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
  }

  var auth = isAuthorized(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: auth.reason });
  }

  var dryRun = parseBoolean(req.query && req.query.dry_run);
  var limit = parsePositiveInt(req.query && req.query.limit);
  if (req.query && req.query.limit != null && limit == null) {
    return res.status(400).json({ ok: false, error: 'Parâmetro "limit" inválido. Use inteiro positivo.' });
  }

  var supabase = null;
  var lockAcquired = false;

  try {
    supabase = createSupabaseAdminClient();
    var lockResult = await supabase.rpc('admin_acquire_import_lock', { p_lock_key: IMPORT_LOCK_KEY });
    if (lockResult.error) {
      throw new Error('Falha ao adquirir lock de importação.');
    }

    lockAcquired = lockResult.data === true;
    if (!lockAcquired) {
      return res.status(200).json({ status: 'already_running' });
    }

    var summary = await exerciseImport.runExerciseImport({
      batchSize: 200,
      exercisesFile: exerciseImport.DEFAULT_EXERCISES_FILE,
      batchDelayMs: 200,
      dryRun: dryRun,
      limit: limit
    });

    return res.status(200).json({
      ok: true,
      message: 'Importação concluída com sucesso.',
      summary: {
        total_batches: summary.totalBatches,
        processed: summary.processed,
        failed_batch: summary.failedBatch
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Falha na importação de exercícios.',
      summary: {
        total_batches: null,
        processed: 0,
        failed_batch: null
      }
    });
  } finally {
    if (lockAcquired && supabase) {
      try {
        await supabase.rpc('admin_release_import_lock', { p_lock_key: IMPORT_LOCK_KEY });
      } catch (releaseError) {}
    }
  }
};
