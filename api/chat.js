// nvidia removido — usando apenas Groq (_gemini.js)
var gemini = require('../src/server/apihelpers/_gemini');
var auth = require('../src/server/apihelpers/_auth');
var cors = require('../src/server/apihelpers/_cors');
var rl = require('../src/server/apihelpers/_ratelimit');
var plans = require('../src/server/apihelpers/_plans');
var logger = require('../src/server/apihelpers/_logger');
var responseUtil = require('../src/server/apihelpers/_response');
var access = require('../src/server/apihelpers/_access');
var dietflow = require('../src/server/apihelpers/_dietflow');
var workoutflow = require('../src/server/apihelpers/_workoutflow');
var diet = require('../src/server/apihelpers/_diet');
var prompts = require('../src/server/apihelpers/_systemPrompts');
var classifier = require('../src/server/apihelpers/_conversationClassifier');
var decisionEngine = require('../src/server/apihelpers/_decisionEngine');
var localReplies = require('../src/server/apihelpers/_localReplies');
var conversationStateUtil = require('../src/server/apihelpers/_conversationState');
var scienceInsight = require('../src/lib/science/scienceInsightService');
var diagnostics = require('../src/server/apihelpers/_diagnosticTracker');
var diagnosticConstants = require('../src/server/apihelpers/_diagnosticConstants');

var TREINO_SYSTEM = `Você é o KRONOS, treinador pessoal aplicado. Responda SOMENTE com JSON válido.
Formato obrigatório: {"treinos":[],"orientacoes":{}}. APENAS JSON.`;

function formatDietSummary(plan) {
  return 'Dieta montada: ' + plan.meta.calorias + ' kcal/dia | '
    + plan.meta.proteina + 'g proteína | '
    + plan.meta.carbo + 'g carbo | '
    + plan.meta.gordura + 'g gordura | '
    + plan.hidratacao.litros + 'L água.';
}

function emitDecisionTelemetry(userId, classification, decision, usedLLM, openedFlow) {
  var payload = {
    event: 'chat_decision',
    userId: userId,
    kind: classification.kind,
    triage: classification.triage,
    topic: decision.topic,
    action: decision.action,
    depth: decision.depth,
    confidence: classification.confidence,
    complexityScore: decision.complexity ? decision.complexity.score : null,
    complexityLevel: decision.complexity ? decision.complexity.level : null,
    complexitySignals: decision.complexity ? decision.complexity.signals : null,
    semanticSignals: classification.semanticSignals || null,
    tokenLimit: decision.tokenLimit,
    usedLLM: !!usedLLM,
    openedFlow: !!openedFlow,
    askClarifying: decision.action === 'ask_clarifying' || decision.action === 'ask_rephrase'
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[chat.telemetry]', JSON.stringify(payload));
  } else {
    console.log('[chat.telemetry]', JSON.stringify(payload));
  }
}

function callChat(system, messages, maxTokens, temp, userId, endpoint, callback) {
  var GROQ_KEY = process.env.GROQ_API_KEY;
  var m = [];
  if (system) m.push({ role: 'system', content: system });
  messages.forEach(function(x) { m.push(x); });
  var payload = { messages: m, max_tokens: maxTokens, temperature: temp, stream: false };

  function onResult(err, result) {
    if (err) return callback(err, null);
    if (userId) {
      logger.logUsage({ userId: userId, endpoint: endpoint || 'chat', promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens, model: result.model });
    }
    callback(null, result.text);
  }

  if (GROQ_KEY) {
    gemini.callGeminiFull(GROQ_KEY, payload, 25000, 3, onResult);
  } else {
    callback('GROQ_API_KEY não configurada', null);
  }
}

function parseWorkout(text) {
  var clean = String(text || '').replace(/```json|```/g, '').trim();
  var s = clean.indexOf('{');
  var e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('no json');
  var p = JSON.parse(clean.slice(s, e + 1));
  if (!p.treinos || !p.treinos.length) throw new Error('invalid');
  return p;
}

function gerarTreino(userMsg, userId, callback) {
  callChat(TREINO_SYSTEM, [userMsg], 3000, 0.1, userId, 'chat-treino', function(err, text) {
    if (err) return callback(err);
    try {
      return callback(null, parseWorkout(text || ''));
    } catch (e) {
      return callback('Erro ao gerar treino: resposta inválida da IA.');
    }
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return responseUtil.sendJson(res, 405, { success: false, type: 'error', message: 'Método não permitido.', error: 'METHOD_NOT_ALLOWED', meta: { fallback: true } });
  }

  auth.requireAuth(req, res, function(user) {
    rl.rateLimit(req, res, function() {
      access.buildAccessProfileWithDb(user, function(_accessErr, accessProfile) {
      accessProfile = accessProfile || access.buildAccessProfile(user, { profileLookupPerformed: true, profileIsAdmin: false });

      function runPaidAiCall(executor, done) {
        plans.getQuotaInfo(user.id, function(qErr, quota) {
          if (qErr) {
            return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true, reason: 'quota_check_failed' } });
          }
          if (!quota.allowed) {
            return responseUtil.sendJson(res, 402, {
              success: false,
              type: 'error',
              message: 'Limite do plano gratuito atingido. Faça upgrade para continuar.',
              error: 'QUOTA_EXCEEDED',
              data: { quota: { used: quota.used, limit: quota.limit, plan: quota.plan } },
              meta: { fallback: true }
            });
          }

          executor(function(err, payload) {
            if (err) return done(err);
            plans.checkAndIncrementQuota(user.id, res, function() {
              done(null, payload, quota);
            }, { accessProfile: accessProfile });
          }, quota);
        }, { accessProfile: accessProfile });
      }

      var b = req.body || {};
      var messages = Array.isArray(b.messages) ? b.messages : [];
      if (!Array.isArray(messages)) {
        return responseUtil.sendJson(res, 400, { success: false, type: 'error', message: 'messages deve ser um array', error: 'INVALID_MESSAGES', meta: { fallback: true } });
      }

      var convState = b.conversationState || null;
      var shortState = conversationStateUtil.extractShortState(convState);
      var lastContent = classifier.extractLastUserMessage(messages);
      var derivedConversationTrace = b.conversationTraceId || b.sessionId || user.id;
      var tracker = new diagnostics.DiagnosticTracker({
        userId: user.id,
        isAdminMode: accessProfile.isAdmin,
        source: b.testMode ? 'admin_test' : 'chat',
        inputType: 'chat_message',
        rawInput: lastContent,
        correlationId: b.correlationId || b.requestId || null,
        conversationTraceId: derivedConversationTrace,
        parentExecutionId: b.parentExecutionId || null,
        sessionId: b.sessionId || null,
        metadata: {
          traceLevel: process.env.ADMIN_DIAGNOSTIC_TRACE_LEVEL || 'standard',
          hasConversationState: !!convState
        }
      });
      tracker.startExecution();
      function safeTrack(fn) {
        try { fn(); } catch (e) { console.error('[diagnostics] tracker operation failed:', e && e.message ? e.message : e); }
      }
      safeTrack(function() {
        tracker.addStep({
          layer: 'input',
          nodeKey: 'Usuario',
          stepName: diagnosticConstants.STEP_NAMES.INPUT_RECEIVED,
          status: 'success',
          success: true,
          inputSummary: lastContent
        });
      });

      function sendTracked(statusCode, payload, outcome) {
        var normalizedPayload = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
        if (typeof normalizedPayload.success !== 'boolean' || typeof normalizedPayload.type !== 'string') {
          console.warn('[chat] diet_response_invalid_contract', JSON.stringify({
            event: 'diet_response_invalid_contract',
            statusCode: statusCode,
            payloadKeys: normalizedPayload ? Object.keys(normalizedPayload) : null
          }));
          normalizedPayload = {
            success: false,
            type: 'error',
            action: null,
            message: 'Resposta interna inválida. Tente novamente em instantes.',
            error: 'INVALID_INTERNAL_CONTRACT',
            data: { content: [{ type: 'text', text: 'Resposta interna inválida.' }] },
            meta: { fallback: true }
          };
          statusCode = 500;
          outcome = 'failure';
        }
        var responseText = normalizedPayload && normalizedPayload.message ? String(normalizedPayload.message) : '';
        var responseSizeEstimate = responseText.length;
        var localReplyEligible = !!(decision && (decision.action === 'local_reply' || decision.action === 'ask_clarifying' || decision.action === 'ask_rephrase'));
        safeTrack(function() {
          tracker.captureQualityFlags({
            intent: classification ? classification.kind : null,
            pipelineSelected: decision ? decision.action : null,
            localReplyEligible: localReplyEligible,
            llmCalled: !localReplyEligible,
            fallbackUsed: !!(normalizedPayload && normalizedPayload.meta && normalizedPayload.meta.fallback),
            lowConfidence: !!(classification && classification.confidence < 0.62),
            responseSizeEstimate: responseSizeEstimate,
            promptSizeEstimate: String(lastContent || '').length,
            durationMs: 0
          });
        });
        if (outcome === 'failure') {
          safeTrack(function() { tracker.markFailure({
            errorCode: payload && payload.error ? payload.error : 'REQUEST_FAILED',
            errorMessage: normalizedPayload && normalizedPayload.message ? normalizedPayload.message : 'Falha na execução.'
          }); });
        } else {
          safeTrack(function() { tracker.markSuccess({
            finalStatus: normalizedPayload && normalizedPayload.success === false ? 'failed' : 'success',
            responseSummary: normalizedPayload && normalizedPayload.message ? normalizedPayload.message : ''
          }); });
        }
        tracker.finishExecution(function(err) {
          if (err) console.error('[diagnostics] failed to persist execution', err);
          return responseUtil.sendJson(res, statusCode, normalizedPayload);
        });
      }

      if (convState && convState.mode === 'diet') {
        safeTrack(function() { tracker.captureDecision({
          graphNode: 'Nutricao',
          reason: 'Continuação de fluxo ativo de dieta.',
          pipelineSelected: 'diet_flow',
          fallbackUsed: true
        }); });
        var dietStep = dietflow.continueDietFlow(convState.stepIndex, convState.collected, lastContent);
        if (!dietStep.finished) {
          safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Nutricao', stepName: diagnosticConstants.STEP_NAMES.DIET_PIPELINE_SELECTED, status: 'success', success: true, inputSummary: lastContent, outputSummary: dietStep.response }); });
          return sendTracked(200, { success: true, type: 'text', message: dietStep.response, data: { conversationState: { mode: dietStep.mode, stepIndex: dietStep.stepIndex, collected: dietStep.collected, memory: shortState } }, meta: { local: true, flow: 'diet' } });
        }
        var dietPlan = diet.buildDietPlan(dietStep.collected);
        safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Nutricao', stepName: 'diet_response_built', status: 'success', success: true, outputSummary: formatDietSummary(dietPlan) }); });
        return sendTracked(200, { success: true, type: 'diet_result', message: formatDietSummary(dietPlan), data: { content: [{ type: 'diet_result', data: dietPlan, text: formatDietSummary(dietPlan) }], conversationState: { memory: shortState } }, meta: { local: true, tokensSaved: true } });
      }

      if (convState && convState.mode === 'workout') {
        safeTrack(function() { tracker.captureDecision({
          graphNode: 'Treino',
          reason: 'Continuação de fluxo ativo de treino.',
          pipelineSelected: 'workout_flow',
          fallbackUsed: true
        }); });
        var workoutStep = workoutflow.continueWorkoutFlow(convState.stepIndex, convState.collected, lastContent);
        if (!workoutStep.finished) {
          safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Treino', stepName: diagnosticConstants.STEP_NAMES.TRAINING_PIPELINE_SELECTED, status: 'success', success: true, inputSummary: lastContent, outputSummary: workoutStep.response }); });
          return sendTracked(200, { success: true, type: 'text', message: workoutStep.response, data: { conversationState: { mode: workoutStep.mode, stepIndex: workoutStep.stepIndex, collected: workoutStep.collected, memory: shortState } }, meta: { local: true, flow: 'workout' } });
        }

        safeTrack(function() { tracker.startStep(diagnosticConstants.STEP_NAMES.WORKOUT_GENERATION_REQUESTED, { layer: 'ai', nodeKey: 'Treino' }); });
        return runPaidAiCall(function(nextCall) {
          var richMsg = { role: 'user', content: workoutflow.buildWorkoutMessage(workoutStep.collected) };
          gerarTreino(richMsg, user.id, nextCall);
        }, function(err, data) {
          if (err) {
            safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.WORKOUT_GENERATION_REQUESTED, { success: false, status: 'error', errorCode: 'PROVIDER_UNAVAILABLE', errorMessage: err }); });
            return sendTracked(503, { success: false, type: 'error', message: err, error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } }, 'failure');
          }
          safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.WORKOUT_GENERATION_REQUESTED, { success: true, outputSummary: 'Treino gerado no modo workout_json.' }); });
          return sendTracked(200, { success: true, type: 'workout_json', message: 'Treino gerado com sucesso.', data: { content: [{ type: 'workout_json', data: data }], conversationState: { memory: shortState } }, meta: {} });
        });
      }

      var normalized = classifier.normalizeConversationInput(lastContent);
      var continuationContext = conversationStateUtil.applyContinuationContext(normalized, shortState);
      var classification = classifier.classifyIntent(normalized, continuationContext);
      var decision = decisionEngine.decideAction(classification, shortState, b.context || {});
      safeTrack(function() { tracker.captureDecision({
        intentDetected: classification.kind || classification.topic || 'unknown',
        intentConfidence: classification.confidence,
        pipelineSelected: decision.action,
        reason: decision.reason || ('Ação selecionada: ' + decision.action),
        fallbackUsed: decision.action !== 'call_llm_full',
        graphNode: decision.action === 'open_diet_flow' ? 'Nutricao' : (classification.topic === 'workout' ? 'Treino' : 'Recomendacao'),
        inputSummary: normalized,
        outputSummary: decision.action
      }); });
      safeTrack(function() {
        tracker.addStep({
          layer: 'classification',
          nodeKey: 'Recomendacao',
          stepName: diagnosticConstants.STEP_NAMES.INTENT_CLASSIFIED,
          status: 'success',
          success: true,
          inputSummary: normalized,
          outputSummary: classification.kind + ' @' + Number(classification.confidence || 0).toFixed(2),
          decisionReason: 'topic=' + classification.topic + ', triage=' + classification.triage
        });
      });
      var nextShortState = conversationStateUtil.updateShortState(shortState, classification, decision, lastContent);

      if (decision.action === 'local_reply' || decision.action === 'ask_clarifying' || decision.action === 'ask_rephrase') {
        var localMessage = localReplies.buildLocalReply(decision, classification);
        emitDecisionTelemetry(user.id, classification, decision, false, false);
        safeTrack(function() { tracker.addStep({ layer: 'response', nodeKey: 'Usuario', stepName: diagnosticConstants.STEP_NAMES.LOCAL_REPLY_SELECTED, status: 'success', success: true, outputSummary: localMessage, decisionReason: decision.action }); });
        safeTrack(function() { tracker.captureMetric({ key: 'llmSkipped', value: true }); });
        return sendTracked(200, {
          success: true,
          type: 'text',
          action: decision.action,
          message: localMessage,
          data: {
            content: [{ type: 'text', text: localMessage }],
            conversationState: { memory: nextShortState }
          },
          meta: { local: true, decision: process.env.NODE_ENV === 'development' ? decision : undefined }
        });
      }

      if (decision.action === 'open_diet_flow') {
        var dietStart = dietflow.startDietFlow();
        emitDecisionTelemetry(user.id, classification, decision, false, true);
        safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Nutricao', stepName: diagnosticConstants.STEP_NAMES.DIET_PIPELINE_SELECTED, status: 'success', success: true, outputSummary: dietStart.response }); });
        return sendTracked(200, {
          success: true,
          type: 'text',
          action: 'open_diet_flow',
          message: dietStart.response,
          data: { conversationState: { mode: dietStart.mode, stepIndex: dietStart.stepIndex, collected: dietStart.collected, memory: nextShortState } },
          meta: { local: true }
        });
      }

      if (decision.action === 'open_workout_flow') {
        var workoutStart = workoutflow.startWorkoutFlow();
        emitDecisionTelemetry(user.id, classification, decision, false, true);
        safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Treino', stepName: diagnosticConstants.STEP_NAMES.TRAINING_PIPELINE_SELECTED, status: 'success', success: true, outputSummary: workoutStart.response }); });
        return sendTracked(200, {
          success: true,
          type: 'text',
          action: 'open_workout_flow',
          message: workoutStart.response,
          data: { conversationState: { mode: workoutStart.mode, stepIndex: workoutStart.stepIndex, collected: workoutStart.collected, memory: nextShortState } },
          meta: { local: true }
        });
      }

      if (decision.action === 'call_agent_tools') {
        emitDecisionTelemetry(user.id, classification, decision, false, false);
        safeTrack(function() { tracker.addStep({ layer: 'router', nodeKey: 'Recomendacao', stepName: 'agent_tools_routed', status: 'success', success: true, outputSummary: '/api/agent' }); });
        return sendTracked(200, {
          success: true,
          type: 'text',
          action: 'call_agent_tools',
          message: 'Para essa análise, usa o modo agent para buscar seus dados reais.',
          data: { route: '/api/agent', conversationState: { memory: nextShortState } },
          meta: { local: true, decision: process.env.NODE_ENV === 'development' ? decision : undefined }
        });
      }

      Promise.resolve()
        .then(function() {
          if (classification.topic === 'general') return null;
          return scienceInsight.buildScienceContextFromText(lastContent);
        })
        .then(function(scienceContext) {
          var context = Object.assign({}, b.context || {});
          if (scienceContext) context.science_context = scienceContext;

          safeTrack(function() { tracker.startStep(diagnosticConstants.STEP_NAMES.LLM_RESPONSE_REQUESTED, { layer: 'ai', nodeKey: 'Recomendacao', inputSummary: lastContent }); });
          safeTrack(function() { tracker.captureMetric({ key: 'promptSizeEstimate', value: String(lastContent || '').length, unit: 'chars' }); });
          runPaidAiCall(function(nextCall) {
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && /\b(monta|cria|gera)\b/.test(classification.sanitizedText)) {
              return gerarTreino({ role: 'user', content: lastContent }, user.id, nextCall);
            }

            var mode = decision.depth || 'short';
            var maxTokens = decision.tokenLimit || decisionEngine.resolveTokenLimit(decision);
            var system = prompts.buildCoachPrompt(mode, classification.topic, context, maxTokens);
            callChat(system, messages, maxTokens, 0.35, user.id, 'chat', nextCall);
          }, function(err, payload) {
            if (err) {
              safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.LLM_RESPONSE_REQUESTED, { success: false, status: 'error', errorCode: 'PROVIDER_UNAVAILABLE', errorMessage: err }); });
              safeTrack(function() { tracker.addStep({ layer: 'fallback', nodeKey: 'Alerta', stepName: diagnosticConstants.STEP_NAMES.LLM_FALLBACK_ACTIVATED, status: 'warning', success: false, errorCode: 'PROVIDER_UNAVAILABLE', decisionReason: 'LLM indisponível no endpoint principal.' }); });
              return sendTracked(503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } }, 'failure');
            }
            safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.LLM_RESPONSE_REQUESTED, { success: true, outputSummary: typeof payload === 'string' ? payload : 'workout_json_payload' }); });
            safeTrack(function() { tracker.captureMetric({ key: 'llmCalled', value: true }); });
            safeTrack(function() { tracker.captureMetric({ key: 'responseSizeEstimate', value: typeof payload === 'string' ? payload.length : JSON.stringify(payload || {}).length, unit: 'chars' }); });
            emitDecisionTelemetry(user.id, classification, decision, true, false);
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && typeof payload === 'object') {
              return sendTracked(200, { success: true, type: 'workout_json', message: 'Treino gerado com sucesso.', data: { content: [{ type: 'workout_json', data: payload }], conversationState: { memory: nextShortState } }, meta: {} });
            }
            return sendTracked(200, {
              success: true,
              type: 'text',
              message: payload,
              data: { content: [{ type: 'text', text: payload }], conversationState: { memory: nextShortState } },
              meta: { decision: process.env.NODE_ENV === 'development' ? decision : undefined }
            });
          });
        })
        .catch(function(err) {
          safeTrack(function() { tracker.markFailure({ errorCode: 'PROVIDER_UNAVAILABLE', errorMessage: (err && err.message) || 'Falha na camada Promise principal.' }); });
          return sendTracked(503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } }, 'failure');
        });

      });
    }, { max: 40, windowMs: 60000 }, user.id);
  });
};
