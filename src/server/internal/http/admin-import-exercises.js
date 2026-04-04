var exerciseImport = require('../exerciseImport');
var supabaseJs = require('@supabase/supabase-js');

var DEFAULT_BATCH_SIZE = 200;
var DEFAULT_HTTP_MAX_ITEMS = 100;

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
  var response = await supabase.rpc('admin_acquire_import_lock', { lock_key: lockKey });
  if (response.error) {
    throw new Error('Falha ao adquirir lock de importação.');
  }
  return response.data === true;
}

async function releaseAdvisoryLock(supabase, lockKey) {
  try {
    await supabase.rpc('admin_release_import_lock', { lock_key: lockKey });
  } catch (error) {}
}

async function hasRunningImport(supabase) {
  var attempts = [
    { p_job_type: 'exercise_import' },
    { p_type: 'exercise_import' },
    { job_type: 'exercise_import' }
  ];
  for (var i = 0; i < attempts.length; i += 1) {
    var result = await supabase.rpc('admin_has_running_import', attempts[i]);
    if (!result.error) {
      return result.data === true;
    }
  }
  throw new Error('Falha ao verificar importação em andamento.');
}

function parseHttpMaxItems() {
  var raw = process.env.IMPORT_HTTP_MAX_ITEMS;
  if (!raw) return DEFAULT_HTTP_MAX_ITEMS;
  var parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_HTTP_MAX_ITEMS;
  }
  return parsed;
}

function buildResponse(payload) {
  var data = payload || {};
  return {
    ok: data.ok === true,
    status: data.status || null,
    jobId: data.jobId == null ? null : data.jobId,
    dryRun: data.dryRun == null ? null : data.dryRun,
    totalExercises: data.totalExercises == null ? null : data.totalExercises,
    batchSize: data.batchSize == null ? null : data.batchSize,
    totalBatches: data.totalBatches == null ? null : data.totalBatches,
    processedBatches: data.processedBatches == null ? null : data.processedBatches,
    importedOrUpdated: data.importedOrUpdated == null ? null : data.importedOrUpdated,
    totalInTable: data.totalInTable == null ? null : data.totalInTable,
    failedBatch: data.failedBatch == null ? null : data.failedBatch,
    message: data.message == null ? null : data.message
  };
}

async function getRunningImportJob(supabase) {
  var result = await supabase
    .from('admin_import_jobs')
    .select('id,total_batches,processed_batches')
    .eq('job_type', 'exercise_import')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1);
  if (result.error) {
    return null;
  }
  if (!Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }
  return result.data[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json(buildResponse({
      ok: false,
      status: 'method_not_allowed',
      message: 'method not allowed; use POST'
    }));
  }

  var auth = isAuthorized(req);
  if (!auth.ok) {
    return res.status(401).json(buildResponse({
      ok: false,
      status: 'unauthorized',
      message: 'unauthorized'
    }));
  }

  var dryRunRaw = getParam(req, 'dryRun');
  if (dryRunRaw == null) {
    dryRunRaw = getParam(req, 'dry_run');
  }
  var dryRun = parseBoolean(String(dryRunRaw == null ? '' : dryRunRaw));

  var limitRaw = getParam(req, 'limit');
  var limit = parsePositiveInt(limitRaw);
  if (limitRaw != null && limit == null) {
    return res.status(400).json(buildResponse({
      ok: false,
      status: 'invalid_input',
      dryRun: dryRun,
      message: 'invalid "limit": use a positive integer'
    }));
  }
  var batchSizeRaw = getParam(req, 'batchSize');
  if (batchSizeRaw == null) {
    batchSizeRaw = getParam(req, 'batch_size');
  }
  var batchSize = parseBatchSizeWithFallback(batchSizeRaw, DEFAULT_BATCH_SIZE);
  if (batchSizeRaw != null && parsePositiveInt(batchSizeRaw) == null) {
    return res.status(400).json(buildResponse({
      ok: false,
      status: 'invalid_input',
      dryRun: dryRun,
      message: 'invalid "batchSize": use a positive integer'
    }));
  }

  var supabase = null;
  var lockAcquired = false;

  try {
    supabase = createSupabaseAdminClient();
    if (await hasRunningImport(supabase)) {
      var runningJobA = await getRunningImportJob(supabase);
      return res.status(200).json(buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJobA && runningJobA.id,
        totalBatches: runningJobA && runningJobA.total_batches,
        processedBatches: runningJobA && runningJobA.processed_batches,
        dryRun: dryRun,
        batchSize: batchSize,
        message: 'exercise import already running'
      }));
    }

    lockAcquired = await tryAcquireAdvisoryLock(supabase, exerciseImport.IMPORT_LOCK_KEY);
    if (!lockAcquired) {
      var runningJobB = await getRunningImportJob(supabase);
      return res.status(200).json(buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJobB && runningJobB.id,
        totalBatches: runningJobB && runningJobB.total_batches,
        processedBatches: runningJobB && runningJobB.processed_batches,
        dryRun: dryRun,
        batchSize: batchSize,
        message: 'exercise import already running'
      }));
    }

    var exercises = await exerciseImport.loadExercisesFromFile(exerciseImport.DEFAULT_EXERCISES_FILE);
    var totalDatasetItems = exercises.length;
    var httpMaxItems = parseHttpMaxItems();
    if (!dryRun && limit == null && totalDatasetItems > httpMaxItems) {
      return res.status(400).json(buildResponse({
        ok: false,
        status: 'requires_limit',
        dryRun: dryRun,
        totalExercises: totalDatasetItems,
        batchSize: batchSize,
        message: 'HTTP import requires limit for large datasets; use limit or CLI for full import'
      }));
    }

    console.info('[admin-import-exercises] Início import', {
      dryRun: dryRun,
      limit: limit,
      batchSize: batchSize
    });

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

    return res.status(200).json(buildResponse({
      ok: true,
      status: summary.status || 'completed',
      jobId: summary.jobId,
      dryRun: summary.dryRun,
      totalExercises: summary.totalExercises,
      batchSize: summary.batchSize,
      totalBatches: summary.totalBatches,
      processedBatches: summary.processedBatches,
      importedOrUpdated: summary.importedOrUpdated,
      totalInTable: summary.totalInTable,
      failedBatch: summary.failedBatch,
      message: 'exercise import completed'
    }));
  } catch (error) {
    console.error('[admin-import-exercises] Erro resumido', {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json(buildResponse({
      ok: false,
      status: 'failed',
      dryRun: dryRun,
      batchSize: batchSize,
      message: 'exercise import failed'
    }));
  } finally {
    console.info('[admin-import-exercises] Finalização import');
    if (lockAcquired && supabase) {
      await releaseAdvisoryLock(supabase, exerciseImport.IMPORT_LOCK_KEY);
    }
  }
};
