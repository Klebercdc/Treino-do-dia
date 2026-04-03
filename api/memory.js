var auth = require('../src/server/apihelpers/_auth');
var cors = require('../src/server/apihelpers/_cors');
var rl = require('../src/server/apihelpers/_ratelimit');
var responseUtil = require('../src/server/apihelpers/_response');
var userMemory = require('../src/server/apihelpers/_userMemory');
var memoryValidation = require('../src/server/apihelpers/_memoryValidation');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

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
      var validation = memoryValidation.validateMemoryEventInput({ eventType: eventType, payload: payload });
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

      userMemory.captureEventAndRecompute({
        userId: user.id,
        eventType: validation.eventType,
        eventKey: eventKey,
        payload: validation.payload,
        requestId: requestId,
        component: 'api/memory',
        source: source
      })
        .then(function(result) {
          return responseUtil.sendJson(res, 200, {
            success: true,
            type: 'memory_event_processed',
            message: 'Evento de memória processado com sucesso.',
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
