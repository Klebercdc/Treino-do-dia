var cors = require('../../src/server/apihelpers/_cors');
var rl = require('../../src/server/apihelpers/_ratelimit');
var responseUtil = require('../../src/server/apihelpers/_response');
var internalAuth = require('../../src/server/apihelpers/_internalAuth');
var userMemory = require('../../src/server/apihelpers/_userMemory');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return responseUtil.sendJson(res, 405, {
      success: false,
      type: 'error',
      state: 'method_not_allowed',
      message: 'Método não permitido.',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  internalAuth.requireInternalAccess(req, res, function() {
    rl.rateLimit(req, res, function() {
      var body = req.body || {};
      var requestId = (body.requestId || req.headers['x-request-id'] || ('memory_worker_' + Date.now()));
      var batchSize = Math.max(1, Math.min(Number(body.batchSize || req.query.batchSize || 20), 50));
      var lockTimeoutSeconds = Math.max(30, Math.min(Number(body.lockTimeoutSeconds || 300), 3600));
      var workerId = String(body.workerId || 'memory_worker');
      var lockToken = workerId + '_' + requestId;

      userMemory.claimQueuedMemoryJobs({ limit: batchSize, lockToken: lockToken, lockTimeoutSeconds: lockTimeoutSeconds })
        .then(async function(claimResult) {
          var jobs = claimResult.jobs || [];
          var results = [];
          for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
            var outcome = await userMemory.processMemoryRecomputeJob({
              job: job,
              lockToken: claimResult.lockToken,
              requestId: requestId
            });
            results.push({
              jobId: job.id,
              userId: job.user_id,
              status: outcome.status,
              attempts: Number(job.attempts || 0),
              blocks: Array.isArray(job.blocks) ? job.blocks : [],
              durationMs: outcome.durationMs,
              retry: outcome.status === 'retryable',
              error: outcome.error || null
            });
          }

          var processed = results.length;
          var completed = results.filter(function(item) { return item.status === 'completed'; }).length;
          var failed = results.filter(function(item) { return item.status === 'failed'; }).length;
          var retryable = results.filter(function(item) { return item.status === 'retryable'; }).length;

          return responseUtil.sendJson(res, 200, {
            success: true,
            type: 'memory_queue_worker',
            state: 'completed',
            message: 'Lote da fila de memória processado.',
            requestId: requestId,
            data: {
              processed: processed,
              completed: completed,
              failed: failed,
              retryable: retryable,
              jobs: results
            },
            meta: {
              batchSize: batchSize,
              lockTimeoutSeconds: lockTimeoutSeconds,
              lockToken: claimResult.lockToken
            }
          });
        })
        .catch(function(err) {
          return responseUtil.sendJson(res, 500, {
            success: false,
            type: 'error',
            state: 'worker_failed',
            message: 'Falha ao processar fila de memória.',
            error: 'MEMORY_WORKER_FAILED',
            requestId: requestId,
            retryable: true,
            meta: {
              error: err && err.message ? err.message : String(err || 'unknown')
            }
          });
        });
    }, { max: 120, windowMs: 60000, category: 'internal_worker' });
  });
};
