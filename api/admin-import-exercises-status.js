var exerciseImport = require('../src/server/internal/exerciseImport');
var supabaseJs = require('@supabase/supabase-js');

function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];
  return Boolean(expected && provided && provided === expected);
}

function createSupabaseAdminClient() {
  var env = exerciseImport.validateRequiredEnv();
  return supabaseJs.createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false }
  });
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
    failedBatch: job.failed_batch
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Não autorizado.' });
  }

  var supabase = createSupabaseAdminClient();
  var jobId = req.query && req.query.jobId;

  try {
    var query = supabase
      .from('admin_import_jobs')
      .select('id,job_type,status,started_at,finished_at,dry_run,limit_count,batch_size,total_exercises,total_batches,processed_batches,imported_or_updated,failed_batch');

    if (jobId) {
      query = query.eq('id', jobId).eq('job_type', 'exercise_import').limit(1);
    } else {
      query = query.eq('job_type', 'exercise_import').order('started_at', { ascending: false }).limit(1);
    }

    var result = await query;
    if (result.error) {
      throw new Error('Falha ao consultar status de importação.');
    }

    var job = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!job) {
      return res.status(404).json({ ok: false, error: 'Job não encontrado.' });
    }
    return res.status(200).json({ ok: true, job: safeJob(job) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Falha interna ao consultar status.' });
  }
};
