// nvidia removido — usando apenas Groq (_gemini.js)
var gemini = require('./_gemini');
var auth = require('./_auth');
var cors = require('./_cors');
var rl = require('./_ratelimit');
var plans = require('./_plans');
var logger = require('./_logger');
var responseUtil = require('./_response');
var access = require('./_access');
var dietflow = require('./_dietflow');
var workoutflow = require('./_workoutflow');
var diet = require('./_diet');
var prompts = require('./_systemPrompts');
var classifier = require('./_conversationClassifier');
var decisionEngine = require('./_decisionEngine');
var localReplies = require('./_localReplies');
var conversationStateUtil = require('./_conversationState');
var scienceInsight = require('../src/lib/science/scienceInsightService');

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
      var accessProfile = access.buildAccessProfile(user);

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

      if (convState && convState.mode === 'diet') {
        var dietStep = dietflow.continueDietFlow(convState.stepIndex, convState.collected, lastContent);
        if (!dietStep.finished) {
          return responseUtil.sendJson(res, 200, { success: true, type: 'text', message: dietStep.response, data: { conversationState: { mode: dietStep.mode, stepIndex: dietStep.stepIndex, collected: dietStep.collected, memory: shortState } }, meta: { local: true, flow: 'diet' } });
        }
        var dietPlan = diet.buildDietPlan(dietStep.collected);
        return responseUtil.sendJson(res, 200, { success: true, type: 'diet_result', message: formatDietSummary(dietPlan), data: { content: [{ type: 'diet_result', data: dietPlan, text: formatDietSummary(dietPlan) }], conversationState: { memory: shortState } }, meta: { local: true, tokensSaved: true } });
      }

      if (convState && convState.mode === 'workout') {
        var workoutStep = workoutflow.continueWorkoutFlow(convState.stepIndex, convState.collected, lastContent);
        if (!workoutStep.finished) {
          return responseUtil.sendJson(res, 200, { success: true, type: 'text', message: workoutStep.response, data: { conversationState: { mode: workoutStep.mode, stepIndex: workoutStep.stepIndex, collected: workoutStep.collected, memory: shortState } }, meta: { local: true, flow: 'workout' } });
        }

        return runPaidAiCall(function(nextCall) {
          var richMsg = { role: 'user', content: workoutflow.buildWorkoutMessage(workoutStep.collected) };
          gerarTreino(richMsg, user.id, nextCall);
        }, function(err, data) {
          if (err) return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: err, error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } });
          return responseUtil.sendJson(res, 200, { success: true, type: 'workout_json', message: 'Treino gerado com sucesso.', data: { content: [{ type: 'workout_json', data: data }], conversationState: { memory: shortState } }, meta: {} });
        });
      }

      var normalized = classifier.normalizeConversationInput(lastContent);
      var continuationContext = conversationStateUtil.applyContinuationContext(normalized, shortState);
      var classification = classifier.classifyIntent(normalized, continuationContext);
      var decision = decisionEngine.decideAction(classification, shortState, b.context || {});
      var nextShortState = conversationStateUtil.updateShortState(shortState, classification, decision, lastContent);

      if (decision.action === 'local_reply' || decision.action === 'ask_clarifying' || decision.action === 'ask_rephrase') {
        var localMessage = localReplies.buildLocalReply(decision, classification);
        emitDecisionTelemetry(user.id, classification, decision, false, false);
        return responseUtil.sendJson(res, 200, {
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
        return responseUtil.sendJson(res, 200, {
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
        return responseUtil.sendJson(res, 200, {
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
        return responseUtil.sendJson(res, 200, {
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

          runPaidAiCall(function(nextCall) {
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && /\b(monta|cria|gera)\b/.test(classification.sanitizedText)) {
              return gerarTreino({ role: 'user', content: lastContent }, user.id, nextCall);
            }

            var mode = decision.depth || 'short';
            var maxTokens = decision.tokenLimit || decisionEngine.resolveTokenLimit(decision);
            var system = prompts.buildCoachPrompt(mode, classification.topic, context, maxTokens);
            callChat(system, messages, maxTokens, 0.35, user.id, 'chat', nextCall);
          }, function(err, payload) {
            if (err) return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } });
            emitDecisionTelemetry(user.id, classification, decision, true, false);
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && typeof payload === 'object') {
              return responseUtil.sendJson(res, 200, { success: true, type: 'workout_json', message: 'Treino gerado com sucesso.', data: { content: [{ type: 'workout_json', data: payload }], conversationState: { memory: nextShortState } }, meta: {} });
            }
            return responseUtil.sendJson(res, 200, {
              success: true,
              type: 'text',
              message: payload,
              data: { content: [{ type: 'text', text: payload }], conversationState: { memory: nextShortState } },
              meta: { decision: process.env.NODE_ENV === 'development' ? decision : undefined }
            });
          });
        })
        .catch(function() {
          return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } });
        });

    }, { max: 40, windowMs: 60000 }, user.id);
  });
};
