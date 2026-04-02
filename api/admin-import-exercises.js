var exerciseImport = require('../src/server/internal/exerciseImport');

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

function getParam(req, key) {
  if (req.query && req.query[key] != null) {
    return req.query[key];
  }
  if (req.body && req.body[key] != null) {
    return req.body[key];
  }
  return null;
}

function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];
  return Boolean(expected && provided && provided === expected);
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
    .eq('job_type', exerciseImport.JOB_TYPE)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1);

  if (result.error) {
    throw new Error('Falha ao consultar job em execução.');
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

  if (!isAuthorized(req)) {
    return res.status(401).json(buildResponse({
      ok: false,
      status: 'unauthorized',
      message: 'unauthorized'
    }));
  }

  var dryRunRaw = getParam(req, 'dryRun');
  if (dryRunRaw == null) dryRunRaw = getParam(req, 'dry_run');
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
  if (batchSizeRaw == null) batchSizeRaw = getParam(req, 'batch_size');
  var batchSize = parsePositiveInt(batchSizeRaw);
  if (batchSizeRaw == null) {
    batchSize = exerciseImport.DEFAULT_BATCH_SIZE;
  }
  if (batchSizeRaw != null && batchSize == null) {
    return res.status(400).json(buildResponse({
      ok: false,
      status: 'invalid_input',
      dryRun: dryRun,
      message: 'invalid "batchSize": use a positive integer'
    }));
  }

  var supabase = exerciseImport.createSupabaseAdminClient();
  var lockAcquired = false;

  try {
    var hasRunning = await exerciseImport.hasRunningImport(supabase);
    if (hasRunning) {
      var runningJob = await getRunningImportJob(supabase);
      return res.status(200).json(buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJob && runningJob.id,
        dryRun: dryRun,
        batchSize: batchSize,
        totalBatches: runningJob && runningJob.total_batches,
        processedBatches: runningJob && runningJob.processed_batches,
        message: 'exercise import already running'
      }));
    }

    lockAcquired = await supabase.rpc('admin_acquire_import_lock', {
      p_lock_key: exerciseImport.IMPORT_LOCK_KEY
    }).then(function(result) {
      if (result.error) {
        throw new Error('Falha ao adquirir lock de importação.');
      }
      return result.data === true;
    });

    if (!lockAcquired) {
      var runningJobFromLock = await getRunningImportJob(supabase);
      return res.status(200).json(buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJobFromLock && runningJobFromLock.id,
        dryRun: dryRun,
        batchSize: batchSize,
        totalBatches: runningJobFromLock && runningJobFromLock.total_batches,
        processedBatches: runningJobFromLock && runningJobFromLock.processed_batches,
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
        dryRun: false,
        totalExercises: totalDatasetItems,
        batchSize: batchSize,
        totalBatches: Math.ceil(totalDatasetItems / batchSize),
        processedBatches: 0,
        importedOrUpdated: 0,
        message: 'HTTP import requires limit for large datasets; use limit or CLI for full import'
      }));
    }

    var summary = await exerciseImport.runExerciseImport({
      batchSize: batchSize,
      batchDelayMs: 200,
      exercisesFile: exerciseImport.DEFAULT_EXERCISES_FILE,
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
      status: summary.status,
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
    return res.status(500).json(buildResponse({
      ok: false,
      status: 'failed',
      dryRun: dryRun,
      batchSize: batchSize,
      message: 'exercise import failed'
    }));
  } finally {
    if (lockAcquired) {
      try {
        await supabase.rpc('admin_release_import_lock', {
          p_lock_key: exerciseImport.IMPORT_LOCK_KEY
        });
      } catch (error) {
        console.error('[admin-import-exercises] Falha ao liberar lock', {
          message: exerciseImport.sanitizeErrorMessage(error)
        });
      }
    }
  }
};
