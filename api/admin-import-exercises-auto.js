var exerciseImport = require('../src/server/internal/exerciseImport');
var supabaseJs = require('@supabase/supabase-js');

var TARGET_TOTAL = 1300;
var AUTO_BATCH_SIZE = 100;
var MAX_AUTO_ATTEMPTS = 20;

function buildResponse(payload) {
  var data = payload || {};
  return {
    ok: data.ok === true,
    status: data.status || null,
    jobId: data.jobId == null ? null : data.jobId,
    currentTotalBefore: data.currentTotalBefore == null ? null : data.currentTotalBefore,
    targetTotal: data.targetTotal == null ? null : data.targetTotal,
    missing: data.missing == null ? null : data.missing,
    importedOrUpdated: data.importedOrUpdated == null ? null : data.importedOrUpdated,
    totalInTable: data.totalInTable == null ? null : data.totalInTable,
    processedBatches: data.processedBatches == null ? null : data.processedBatches,
    totalBatches: data.totalBatches == null ? null : data.totalBatches,
    message: data.message == null ? null : data.message
  };
}

function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];
  return Boolean(expected && provided && provided === expected);
}

function isAutoEnabled() {
  var raw = process.env.AUTO_IMPORT_EXERCISES;
  return raw === 'true' || raw === '1';
}

function sanitizeErrorMessage(error) {
  var message = error instanceof Error ? error.message : String(error);
  message = message.replace(/([A-Za-z]:)?[\\/][^ ]+/g, '[path]');
  return message.slice(0, 300);
}

function createSupabaseAdminClient() {
  var env = exerciseImport.validateRequiredEnv();
  return supabaseJs.createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false }
  });
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

async function getRunningImportJob(supabase) {
  var result = await supabase
    .from('admin_import_jobs')
    .select('id,total_batches,processed_batches')
    .eq('job_type', 'exercise_import')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1);
  if (result.error || !Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }
  return result.data[0];
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

async function getExercisesCount(supabase) {
  var result = await supabase.from('exercises').select('*', { count: 'exact', head: true });
  if (result.error) {
    throw new Error('Falha ao consultar total da tabela exercises.');
  }
  return result.count || 0;
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

  if (!isAutoEnabled()) {
    return res.status(403).json(buildResponse({
      ok: false,
      status: 'disabled',
      targetTotal: TARGET_TOTAL,
      message: 'auto import disabled'
    }));
  }

  var supabase = null;
  var lockAcquired = false;
  var currentTotalBefore = null;
  var missing = null;

  try {
    supabase = createSupabaseAdminClient();
    currentTotalBefore = await getExercisesCount(supabase);
    missing = TARGET_TOTAL - currentTotalBefore;

    if (missing <= 0) {
      return res.status(200).json(buildResponse({
        ok: true,
        status: 'already_complete',
        currentTotalBefore: currentTotalBefore,
        targetTotal: TARGET_TOTAL,
        missing: 0,
        totalInTable: currentTotalBefore,
        message: 'exercise catalog already has 1300 or more records'
      }));
    }

    if (await hasRunningImport(supabase)) {
      var runningJobA = await getRunningImportJob(supabase);
      return res.status(200).json(buildResponse({
        ok: false,
        status: 'already_running',
        jobId: runningJobA && runningJobA.id,
        currentTotalBefore: currentTotalBefore,
        targetTotal: TARGET_TOTAL,
        missing: missing,
        processedBatches: runningJobA && runningJobA.processed_batches,
        totalBatches: runningJobA && runningJobA.total_batches,
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
        currentTotalBefore: currentTotalBefore,
        targetTotal: TARGET_TOTAL,
        missing: missing,
        processedBatches: runningJobB && runningJobB.processed_batches,
        totalBatches: runningJobB && runningJobB.total_batches,
        message: 'exercise import already running'
      }));
    }

    var datasetExercises = await exerciseImport.loadExercisesFromFile(exerciseImport.DEFAULT_EXERCISES_FILE);
    var availableInDataset = Array.isArray(datasetExercises) ? datasetExercises.length : 0;

    if (availableInDataset === 0) {
      return res.status(200).json(buildResponse({
        ok: false,
        status: 'dataset_exhausted',
        currentTotalBefore: currentTotalBefore,
        targetTotal: TARGET_TOTAL,
        missing: missing,
        totalInTable: currentTotalBefore,
        message: 'no exercises available in dataset file'
      }));
    }

    console.info('[admin-import-exercises-auto] Início import automático', {
      currentTotalBefore: currentTotalBefore,
      targetTotal: TARGET_TOTAL,
      missing: missing,
      availableInDataset: availableInDataset,
      batchSize: AUTO_BATCH_SIZE
    });

    var currentTotal = currentTotalBefore;
    var lastJobId = null;
    var totalImportedOrUpdated = 0;
    var totalProcessedBatches = 0;
    var totalBatches = 0;
    var attempt = 0;
    var attemptLimit = Math.min(missing, availableInDataset);

    while (currentTotal < TARGET_TOTAL && attempt < MAX_AUTO_ATTEMPTS) {
      attempt += 1;
      var beforeAttempt = currentTotal;
      var currentMissing = TARGET_TOTAL - currentTotal;
      attemptLimit = Math.min(currentMissing, availableInDataset);
      if (attemptLimit <= 0) {
        break;
      }

      console.info('[admin-import-exercises-auto] Tentativa automática', {
        attempt: attempt,
        currentTotal: currentTotal,
        missing: currentMissing,
        importLimit: attemptLimit,
        availableInDataset: availableInDataset,
        batchSize: AUTO_BATCH_SIZE
      });

      var summary = await exerciseImport.runExerciseImport({
        dryRun: false,
        limit: attemptLimit,
        batchSize: AUTO_BATCH_SIZE,
        batchDelayMs: 200,
        requestedBy: 'auto-endpoint',
        exercisesFile: exerciseImport.DEFAULT_EXERCISES_FILE,
        lockAlreadyHeld: true,
        logger: function(message) {
          console.info('[admin-import-exercises-auto]', message);
        }
      });

      lastJobId = summary.jobId;
      totalImportedOrUpdated += summary.importedOrUpdated || 0;
      totalProcessedBatches += summary.processedBatches || 0;
      totalBatches += summary.totalBatches || 0;
      currentTotal = await getExercisesCount(supabase);

      if (currentTotal >= TARGET_TOTAL) {
        return res.status(200).json(buildResponse({
          ok: true,
          status: 'completed',
          jobId: lastJobId,
          currentTotalBefore: currentTotalBefore,
          targetTotal: TARGET_TOTAL,
          missing: 0,
          importedOrUpdated: totalImportedOrUpdated,
          totalInTable: currentTotal,
          processedBatches: totalProcessedBatches,
          totalBatches: totalBatches,
          message: 'exercise auto import completed'
        }));
      }

      if (currentTotal <= beforeAttempt) {
        // No new rows — dataset upserted duplicates only; further attempts won't help
        console.warn('[admin-import-exercises-auto] Sem progresso após tentativa ' + attempt + '. Dataset provavelmente esgotado.');
        break;
      }
    }

    return res.status(409).json(buildResponse({
      ok: false,
      status: 'incomplete',
      jobId: lastJobId,
      currentTotalBefore: currentTotalBefore,
      targetTotal: TARGET_TOTAL,
      missing: Math.max(0, TARGET_TOTAL - currentTotal),
      importedOrUpdated: totalImportedOrUpdated,
      totalInTable: currentTotal,
      processedBatches: totalProcessedBatches,
      totalBatches: totalBatches,
      message: 'exercise auto import could not reach target safely'
    }));
  } catch (error) {
    console.error('[admin-import-exercises-auto] Erro resumido', {
      message: sanitizeErrorMessage(error)
    });
    return res.status(500).json(buildResponse({
      ok: false,
      status: 'failed',
      currentTotalBefore: currentTotalBefore,
      targetTotal: TARGET_TOTAL,
      missing: missing,
      message: 'exercise auto import failed'
    }));
  } finally {
    console.info('[admin-import-exercises-auto] Finalização import automático');
    if (lockAcquired && supabase) {
      await releaseAdvisoryLock(supabase, exerciseImport.IMPORT_LOCK_KEY);
    }
  }
};
