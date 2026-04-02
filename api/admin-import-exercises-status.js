var exerciseImport = require('../src/server/internal/exerciseImport');

function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];
  return Boolean(expected && provided && provided === expected);
}

function buildStatusResponse(payload) {
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
    errorMessage: data.errorMessage == null ? null : data.errorMessage,
    message: data.message == null ? null : data.message,
    job: data.job || null
  };
}

function safeJob(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    jobType: job.job_type,
    status: job.status,
    started: job.started_at,
    finished: job.finished_at,
    dryRun: job.dry_run,
    limit: job.limit_count,
    batchSize: job.batch_size,
    totalExercises: job.total_exercises,
    totalBatches: job.total_batches,
    processedBatches: job.processed_batches,
    importedOrUpdated: job.imported_or_updated,
    failedBatch: job.failed_batch,
    errorMessage: exerciseImport.sanitizeErrorMessage(job.error_message)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json(buildStatusResponse({
      ok: false,
      status: 'method_not_allowed',
      message: 'method not allowed; use GET'
    }));
  }

  if (!isAuthorized(req)) {
    return res.status(401).json(buildStatusResponse({
      ok: false,
      status: 'unauthorized',
      message: 'unauthorized'
    }));
  }

  var supabase = exerciseImport.createSupabaseAdminClient();
  var requestedJobId = req.query && req.query.jobId;

  try {
    var query = supabase
      .from('admin_import_jobs')
      .select('id,job_type,status,started_at,finished_at,dry_run,limit_count,batch_size,total_exercises,total_batches,processed_batches,imported_or_updated,failed_batch,error_message')
      .eq('job_type', exerciseImport.JOB_TYPE);

    if (requestedJobId) {
      query = query.eq('id', requestedJobId).limit(1);
    } else {
      query = query.order('started_at', { ascending: false }).limit(1);
    }

    var result = await query;
    if (result.error) {
      throw new Error('Falha ao consultar status de importação.');
    }

    var job = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!job) {
      return res.status(404).json(buildStatusResponse({
        ok: false,
        status: 'not_found',
        message: 'exercise import job not found'
      }));
    }

    var safe = safeJob(job);
    return res.status(200).json(buildStatusResponse({
      ok: true,
      status: 'found',
      jobId: safe.jobId,
      dryRun: safe.dryRun,
      totalExercises: safe.totalExercises,
      batchSize: safe.batchSize,
      totalBatches: safe.totalBatches,
      processedBatches: safe.processedBatches,
      importedOrUpdated: safe.importedOrUpdated,
      failedBatch: safe.failedBatch,
      errorMessage: safe.errorMessage,
      message: 'exercise import job found',
      job: safe
    }));
  } catch (error) {
    return res.status(500).json(buildStatusResponse({
      ok: false,
      status: 'failed',
      message: 'failed to query import status'
    }));
  }
};
