var exerciseImport = require('../src/server/internal/exerciseImport');
var supabaseJs = require('@supabase/supabase-js');

var DEFAULT_BATCH_SIZE = 200;

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

function parseBatchSizeWithFallback(value, fallback) {
  var parsed = parsePositiveInt(value);
  return parsed == null ? fallback : parsed;
}

function getParam(req, key) {
  if (req.query && req.query[key] != null) {
    return req.query[key];
  }
  if (req.body && req.body[key] != null) {
    return req.body[key];
  }
  return null;
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
    return { ok: false };
  }

  if (!provided || provided !== expected) {
    return { ok: false };
  }

  return { ok: true };
}

async function tryAcquireAdvisoryLock(supabase, lockKey) {
  var response = await supabase.rpc('admin_acquire_import_lock', { p_lock_key: lockKey });
  if (response.error) {
    throw new Error('Falha ao adquirir lock de importação.');
  }
  return response.data === true;
}

async function releaseAdvisoryLock(supabase, lockKey) {
  try {
    await supabase.rpc('admin_release_import_lock', { p_lock_key: lockKey });
  } catch (error) {}
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
  }

  var auth = isAuthorized(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: 'Não autorizado.' });
  }

  var dryRunRaw = getParam(req, 'dryRun');
  if (dryRunRaw == null) {
    dryRunRaw = getParam(req, 'dry_run');
  }
  var dryRun = parseBoolean(String(dryRunRaw == null ? '' : dryRunRaw));

  var limitRaw = getParam(req, 'limit');
  var limit = parsePositiveInt(limitRaw);
  if (limitRaw != null && limit == null) {
    return res.status(400).json({ ok: false, error: 'Parâmetro "limit" inválido. Use inteiro positivo.' });
  }
  var batchSize = parseBatchSizeWithFallback(getParam(req, 'batchSize'), DEFAULT_BATCH_SIZE);

  var supabase = null;
  var lockAcquired = false;

  try {
    supabase = createSupabaseAdminClient();
    var running = await supabase.rpc('admin_has_running_import', { p_type: 'exercise_import' });
    if (running.error) {
      throw new Error('Falha ao verificar importação em andamento.');
    }
    if (running.data === true) {
      return res.status(200).json({ status: 'already_running' });
    }

    lockAcquired = await tryAcquireAdvisoryLock(supabase, exerciseImport.IMPORT_LOCK_KEY);
    if (!lockAcquired) {
      return res.status(200).json({ status: 'already_running' });
    }

    var summary = await exerciseImport.runExerciseImport({
      batchSize: batchSize,
      exercisesFile: exerciseImport.DEFAULT_EXERCISES_FILE,
      batchDelayMs: 200,
      dryRun: dryRun,
      limit: limit,
      requestedBy: req.headers['x-requested-by'] || 'admin-endpoint',
      lockAlreadyHeld: true,
      logger: function(message) {
        console.info('[admin-import-exercises]', message);
      }
    });

    return res.status(200).json({
      ok: true,
      summary: summary
    });
  } catch (error) {
    console.error('[admin-import-exercises] Erro resumido', {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      ok: false,
      error: 'Falha interna na importação.'
    });
  } finally {
    if (lockAcquired && supabase) {
      await releaseAdvisoryLock(supabase, exerciseImport.IMPORT_LOCK_KEY);
    }
  }
};
