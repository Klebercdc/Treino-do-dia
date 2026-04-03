var auth = require('../src/server/apihelpers/_auth');
var cors = require('../src/server/apihelpers/_cors');
var rl = require('../src/server/apihelpers/_ratelimit');
var responseUtil = require('../src/server/apihelpers/_response');
var internalAuth = require('../src/server/apihelpers/_internalAuth');
var userMemory = require('../src/server/apihelpers/_userMemory');
var memoryValidation = require('../src/server/apihelpers/_memoryValidation');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();


  var isInternalWorkerCall = String((req.query && req.query.action) || (req.body && req.body.action) || '').toLowerCase() === 'process_queue';
  if (isInternalWorkerCall) {
    return internalAuth.requireInternalAccess(req, res, function() {
      return rl.rateLimit(req, res, function() {
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
              var outcome = await userMemory.processMemoryRecomputeJob({
                job: jobs[i],
                lockToken: claimResult.lockToken,
                requestId: requestId
              });
              results.push({
                jobId: jobs[i].id,
                userId: jobs[i].user_id,
                status: outcome.status,
                attempts: Number(jobs[i].attempts || 0),
                blocks: Array.isArray(jobs[i].blocks) ? jobs[i].blocks : [],
                durationMs: outcome.durationMs,
                retry: outcome.status === 'retryable',
                error: outcome.error || null
              });
            }

            return responseUtil.sendJson(res, 200, {
              success: true,
              type: 'memory_queue_worker',
              state: 'completed',
              message: 'Lote da fila de memória processado.',
              requestId: requestId,
              data: {
                processed: results.length,
                completed: results.filter(function(item) { return item.status === 'completed'; }).length,
                failed: results.filter(function(item) { return item.status === 'failed'; }).length,
                retryable: results.filter(function(item) { return item.status === 'retryable'; }).length,
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
              meta: { error: err && err.message ? err.message : String(err || 'unknown') }
            });
          });
      }, { max: 120, windowMs: 60000, category: 'internal_worker', strictRemote: true });
    });
  }

  auth.requireAuth(req, res, function(user) {
    rl.rateLimit(req, res, function() {
      var requestId = (req.body && req.body.requestId) || req.headers['x-request-id'] || ('memory_' + Date.now());
      var action = req.method === 'GET'
        ? String((req.query && req.query.action) || 'snapshot')
        : String((req.body && req.body.action) || 'append_event');

      if (req.method === 'GET') {
        if (action === 'summary') {
          return userMemory.getCoachingSummary(user.id)
            .then(function(summary) {
              return responseUtil.sendJson(res, 200, {
                success: true,
                type: 'memory_summary',
                message: summary && summary.text ? summary.text : 'Sem memória consolidada ainda.',
                requestId: requestId,
                userId: user.id,
                data: { summary: summary || null }
              });
            })
            .catch(function(err) {
              return responseUtil.sendJson(res, 500, { success: false, type: 'error', state: 'provider_unavailable', message: 'Não foi possível carregar o resumo evolutivo agora.', error: 'MEMORY_SUMMARY_FAILED', meta: { requestId: requestId, error: err && err.message ? err.message : String(err || 'unknown') } });
            });
        }

        if (action === 'progress') {
          return userMemory.getProgressAnalysis(user.id)
            .then(function(progress) {
              return responseUtil.sendJson(res, 200, {
                success: true,
                type: 'progress_analysis',
                message: progress.explanation,
                requestId: requestId,
                userId: user.id,
                data: { progress: progress }
              });
            })
            .catch(function(err) {
              return responseUtil.sendJson(res, 500, { success: false, type: 'error', state: 'provider_unavailable', message: 'Não foi possível calcular análise de progresso agora.', error: 'PROGRESS_ANALYSIS_FAILED', meta: { requestId: requestId, error: err && err.message ? err.message : String(err || 'unknown') } });
            });
        }

        return userMemory.getUserMemorySnapshot(user.id)
          .then(function(snapshot) {
            return responseUtil.sendJson(res, 200, {
              success: true,
              type: 'memory_snapshot',
              message: 'Snapshot de memória evolutiva carregado.',
              requestId: requestId,
              userId: user.id,
              data: { snapshot: snapshot || null }
            });
          })
          .catch(function(err) {
            return responseUtil.sendJson(res, 500, { success: false, type: 'error', state: 'provider_unavailable', message: 'Não foi possível carregar a memória evolutiva agora.', error: 'MEMORY_SNAPSHOT_FAILED', meta: { requestId: requestId, error: err && err.message ? err.message : String(err || 'unknown') } });
          });
      }

      if (req.method !== 'POST') {
        return responseUtil.sendJson(res, 405, { success: false, type: 'error', message: 'Método não permitido.', error: 'METHOD_NOT_ALLOWED' });
      }

      var body = req.body || {};
      var eventType = String(body.eventType || body.event_type || 'checkin');
      var payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
      var source = body.source || 'memory_api';
      var eventKey = body.eventKey || (user.id + ':' + eventType + ':' + requestId);
      var validation = memoryValidation.validateMemoryEventInput({ eventType: eventType, payload: payload, source: source, eventVersion: body.eventVersion });
      if (!validation.ok) {
        return responseUtil.sendJson(res, validation.status || 400, {
          success: false,
          type: 'error',
          state: 'invalid_request',
          message: validation.message,
          error: validation.code,
          retryable: false,
          meta: { requestId: requestId }
        });
      }

      userMemory.captureEventAndEnqueue({
        userId: user.id,
        eventType: validation.eventType,
        eventKey: eventKey,
        payload: validation.payload,
        requestId: requestId,
        component: 'api/memory',
        source: validation.source
      })
        .then(function(result) {
          return responseUtil.sendJson(res, 200, {
            success: true,
            type: 'memory_event_enqueued',
            message: 'Evento de memória recebido e enfileirado com sucesso.',
            requestId: requestId,
            userId: user.id,
            data: result
          });
        })
        .catch(function(err) {
          return responseUtil.sendJson(res, 500, {
            success: false,
            type: 'error',
            state: 'provider_unavailable',
            message: 'Não foi possível processar evento de memória agora.',
            error: 'MEMORY_EVENT_FAILED',
            retryable: true,
            meta: { requestId: requestId, error: err && err.message ? err.message : String(err || 'unknown') }
          });
        });
    }, { max: 40, windowMs: 60000, category: 'memory_api' }, user.id);
  });
};
