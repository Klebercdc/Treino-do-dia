var exerciseImport = require('../src/server/internal/exerciseImport');
var supabaseJs = require('@supabase/supabase-js');

var IMPORT_LOCK_KEY = 948221;
var DEFAULT_BATCH_SIZE = 200;
var DEFAULT_EXERCISES_LABEL = 'data/exercises.json';

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
  var attempts = [
    { fn: 'pg_try_advisory_lock', args: { key: lockKey } },
    { fn: 'pg_try_advisory_lock', args: { p_key: lockKey } },
    { fn: 'admin_acquire_import_lock', args: { p_lock_key: lockKey } }
  ];

  for (var i = 0; i < attempts.length; i += 1) {
    var attempt = attempts[i];
    var response = await supabase.rpc(attempt.fn, attempt.args);
    if (!response.error) {
      return response.data === true;
    }
  }

  throw new Error('Não foi possível adquirir lock de importação.');
}

async function releaseAdvisoryLock(supabase, lockKey) {
  var attempts = [
    { fn: 'pg_advisory_unlock', args: { key: lockKey } },
    { fn: 'pg_advisory_unlock', args: { p_key: lockKey } },
    { fn: 'admin_release_import_lock', args: { p_lock_key: lockKey } }
  ];

  for (var i = 0; i < attempts.length; i += 1) {
    try {
      var attempt = attempts[i];
      var response = await supabase.rpc(attempt.fn, attempt.args);
      if (!response.error) {
        return true;
      }
    } catch (error) {}
  }

  return false;
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

  var started = new Date().toISOString();
  var dryRun = parseBoolean(req.query && req.query.dry_run);
  var limit = parsePositiveInt(req.query && req.query.limit);
  var batchSize = parseBatchSizeWithFallback(req.query && req.query.batchSize, DEFAULT_BATCH_SIZE);
  if (req.query && req.query.limit != null && limit == null) {
    return res.status(400).json({ ok: false, error: 'Parâmetro "limit" inválido. Use inteiro positivo.' });
  }

  var supabase = null;
  var lockAcquired = false;

  try {
    supabase = createSupabaseAdminClient();
    lockAcquired = await tryAcquireAdvisoryLock(supabase, IMPORT_LOCK_KEY);
    if (!lockAcquired) {
      return res.status(200).json({
        ok: true,
        summary: {
          started: started,
          dryRun: dryRun,
          totalExercises: 0,
          batchSize: batchSize,
          totalBatches: 0,
          processedBatches: 0,
          importedOrUpdated: 0,
          totalInTable: null,
          alreadyRunning: true
        }
      });
    }

    console.info('[admin-import-exercises] Início importação', {
      started: started,
      dryRun: dryRun,
      limit: limit,
      batchSize: batchSize,
      source: DEFAULT_EXERCISES_LABEL
    });

    var summary = await exerciseImport.runExerciseImport({
      batchSize: batchSize,
      exercisesFile: exerciseImport.DEFAULT_EXERCISES_FILE,
      batchDelayMs: 200,
      dryRun: dryRun,
      limit: limit,
      logger: function(message) {
        console.info('[admin-import-exercises]', message);
      }
    });

    console.info('[admin-import-exercises] Finalizado', {
      started: started,
      processedBatches: summary.processedBatches,
      importedOrUpdated: summary.importedOrUpdated,
      totalInTable: summary.finalExercisesCount
    });

    return res.status(200).json({
      ok: true,
      summary: {
        started: started,
        dryRun: summary.dryRun,
        totalExercises: summary.totalInputExercises,
        batchSize: summary.batchSize,
        totalBatches: summary.totalBatches,
        processedBatches: summary.processedBatches,
        importedOrUpdated: summary.importedOrUpdated,
        totalInTable: summary.finalExercisesCount,
        alreadyRunning: false
      }
    });
  } catch (error) {
    console.error('[admin-import-exercises] Erro resumido', {
      started: started,
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      ok: false,
      error: 'Falha na importação de exercícios.',
      summary: {
        started: started,
        dryRun: dryRun,
        totalExercises: 0,
        batchSize: batchSize,
        totalBatches: 0,
        processedBatches: 0,
        importedOrUpdated: 0,
        totalInTable: null,
        alreadyRunning: false
      }
    });
  } finally {
    if (lockAcquired && supabase) {
      await releaseAdvisoryLock(supabase, IMPORT_LOCK_KEY);
    }
  }
};
