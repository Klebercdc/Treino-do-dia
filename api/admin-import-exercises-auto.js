var exerciseImport = require('../src/server/internal/exerciseImport');

var AUTO_IMPORT_TARGET = 1300;
var AUTO_IMPORT_BATCH_SIZE = 100;

function isAuthorized(req) {
  var adminKey = process.env.IMPORT_ADMIN_KEY;
  var providedAdminKey = req.headers['x-admin-key'];

  if (adminKey && providedAdminKey && providedAdminKey === adminKey) {
    return true;
  }

  var cronSecret = process.env.CRON_SECRET;
  var authHeader = req.headers.authorization || req.headers.Authorization;
  if (cronSecret && authHeader === 'Bearer ' + cronSecret) {
    return true;
  }

  return false;
}

function isAutoImportEnabled() {
  var value = process.env.AUTO_IMPORT_EXERCISES;
  return value === 'true' || value === '1';
}

function buildResponse(payload) {
  var data = payload || {};
  return {
    ok: data.ok === true,
    status: data.status || null,
    jobId: data.jobId == null ? null : data.jobId,
    dryRun: false,
    totalExercises: data.totalExercises == null ? null : data.totalExercises,
    batchSize: data.batchSize == null ? AUTO_IMPORT_BATCH_SIZE : data.batchSize,
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

async function runAutoImportFlow(options) {
  var requestedBy = (options && options.requestedBy) || 'admin-auto-endpoint';
  var supabase = exerciseImport.createSupabaseAdminClient();
  var lockAcquired = false;

  try {
    var currentCount = await exerciseImport.getExercisesCount(supabase);
    if (currentCount >= AUTO_IMPORT_TARGET) {
      return buildResponse({
        ok: true,
        status: 'already_complete',
        totalInTable: currentCount,
        totalExercises: 0,
        totalBatches: 0,
        processedBatches: 0,
        importedOrUpdated: 0,
        message: 'catalog already complete'
      });
    }

    var hasRunning = await exerciseImport.hasRunningImport(supabase);
    if (hasRunning) {
      var runningJob = await getRunningImportJob(supabase);
      return buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJob && runningJob.id,
        totalBatches: runningJob && runningJob.total_batches,
        processedBatches: runningJob && runningJob.processed_batches,
        totalInTable: currentCount,
        importedOrUpdated: 0,
        message: 'exercise import already running'
      });
    }

    var lockResult = await supabase.rpc('admin_acquire_import_lock', { p_lock_key: exerciseImport.IMPORT_LOCK_KEY });
    if (lockResult.error) {
      throw new Error('Falha ao adquirir lock de importação.');
    }

    lockAcquired = lockResult.data === true;
    if (!lockAcquired) {
      var runningJobByLock = await getRunningImportJob(supabase);
      return buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJobByLock && runningJobByLock.id,
        totalBatches: runningJobByLock && runningJobByLock.total_batches,
        processedBatches: runningJobByLock && runningJobByLock.processed_batches,
        totalInTable: currentCount,
        importedOrUpdated: 0,
        message: 'exercise import already running'
      });
    }

    var exercises = await exerciseImport.loadExercisesFromFile(exerciseImport.DEFAULT_EXERCISES_FILE);
    var missing = AUTO_IMPORT_TARGET - currentCount;
    var importLimit = Math.min(missing, exercises.length);

    if (importLimit <= 0) {
      return buildResponse({
        ok: true,
        status: 'already_complete',
        totalInTable: currentCount,
        totalExercises: 0,
        totalBatches: 0,
        processedBatches: 0,
        importedOrUpdated: 0,
        message: 'no new exercises available for import'
      });
    }

    var summary = await exerciseImport.runExerciseImport({
      dryRun: false,
      limit: importLimit,
      batchSize: AUTO_IMPORT_BATCH_SIZE,
      requestedBy: requestedBy,
      lockAlreadyHeld: true,
      logger: function(message) {
        console.info('[admin-import-exercises-auto]', message);
      }
    });

    return buildResponse({
      ok: true,
      status: summary.status,
      jobId: summary.jobId,
      totalExercises: summary.totalExercises,
      batchSize: summary.batchSize,
      totalBatches: summary.totalBatches,
      processedBatches: summary.processedBatches,
      importedOrUpdated: summary.importedOrUpdated,
      totalInTable: summary.totalInTable,
      failedBatch: summary.failedBatch,
      message: 'exercise auto import completed'
    });
  } finally {
    if (lockAcquired) {
      try {
        await supabase.rpc('admin_release_import_lock', { p_lock_key: exerciseImport.IMPORT_LOCK_KEY });
      } catch (error) {
        console.error('[admin-import-exercises-auto] Falha ao liberar lock', {
          message: exerciseImport.sanitizeErrorMessage(error)
        });
      }
    }
  }
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

  if (!isAutoImportEnabled()) {
    return res.status(403).json(buildResponse({
      ok: false,
      status: 'disabled',
      message: 'auto import disabled'
    }));
  }

  try {
    var response = await runAutoImportFlow({
      requestedBy: req.headers['x-requested-by'] || 'admin-auto-endpoint'
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(buildResponse({
      ok: false,
      status: 'failed',
      message: 'exercise auto import failed'
    }));
  }
};

module.exports.runAutoImportFlow = runAutoImportFlow;
