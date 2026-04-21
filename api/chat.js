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
var workoutBuilder = require('../src/server/apihelpers/_workoutBuilder');
var workoutService = require('../src/services/workout/workoutService');
var diet = require('../src/server/apihelpers/_diet');
var prompts = require('../src/server/apihelpers/_systemPrompts');
var classifier = require('../src/server/apihelpers/_conversationClassifier');
var decisionEngine = require('../src/server/apihelpers/_decisionEngine');
var localReplies = require('../src/server/apihelpers/_localReplies');
var conversationStateUtil = require('../src/server/apihelpers/_conversationState');
var scienceInsight = require('../src/lib/science/scienceInsightService');
var diagnostics = require('../src/server/apihelpers/_diagnosticTracker');
var diagnosticConstants = require('../src/server/apihelpers/_diagnosticConstants');
var aiContracts = require('../src/server/apihelpers/_aiContracts');
var userMemory = require('../src/server/apihelpers/_userMemory');
var kronosHub = require('../src/server/apihelpers/_kronosContextHub');
var askKronosService = require('../src/ai/kronos/askKronos');

var TREINO_SYSTEM = `Você é o KRONOS, treinador pessoal aplicado. Responda SOMENTE com JSON válido.
Formato obrigatório: {"treinos":[],"orientacoes":{}}. APENAS JSON.`;

function formatDietSummary(plan) {
  return 'Dieta montada: ' + plan.meta.calorias + ' kcal/dia | '
    + plan.meta.proteina + 'g proteína | '
    + plan.meta.carbo + 'g carbo | '
    + plan.meta.gordura + 'g gordura | '
    + plan.hidratacao.litros + 'L água.';
}

function buildDietSuccessPayload(message, dietData, extraData, extraMeta) {
  var safeMessage = String(message || '').trim();
  var normalizedDietData = dietData && typeof dietData === 'object' ? Object.assign({}, dietData) : {};
  if (normalizedDietData.failSafe === true && !normalizedDietData.flow_state) {
    normalizedDietData.flow_state = 'failsafe';
  }
  var payloadData = Object.assign({}, extraData || {});
  payloadData.content = [{
    type: 'diet_result',
    data: normalizedDietData,
    text: safeMessage
  }];
  return {
    success: true,
    type: 'diet_result',
    message: safeMessage,
    data: payloadData,
    meta: Object.assign({}, extraMeta || {})
  };
}

function buildDietCollectingPayload(message, collectingData, extraData, extraMeta) {
  var safeMessage = String(message || '').trim() || 'Vamos continuar montando sua dieta.';
  var payloadData = Object.assign({}, extraData || {});
  payloadData.content = [{
    type: 'diet_result',
    data: Object.assign({ flow_state: 'collecting' }, collectingData || {}),
    text: safeMessage
  }];
  return {
    success: true,
    type: 'diet_result',
    message: safeMessage,
    data: payloadData,
    meta: Object.assign({ flow: 'diet_collecting' }, extraMeta || {})
  };
}

function buildDietErrorPayload() {
  return {
    success: false,
    type: 'error',
    message: 'Não consegui montar a dieta agora. Tente novamente em instantes.',
    data: { content: [] },
    error: 'DIET_PIPELINE_ERROR',
    meta: { fallback: true }
  };
}

function normalizeCentralAction(action) {
  var raw = String(action || '').trim();
  if (raw === 'open_workout_flow' || raw === 'abrir_tela_treino_com_payload') return 'open_training';
  if (raw === 'open_diet_flow' || raw === 'abrir_config_dieta') return 'open_diet';
  if (raw === 'gerar_pdf_dieta') return 'generate_diet';
  return null;
}

function buildConversationIntent(action, payload, source) {
  var canonical = normalizeCentralAction(action);
  if (!canonical) return null;
  return {
    type: canonical,
    eligible: true,
    label: canonical === 'open_training' ? 'Abrir treino' : (canonical === 'generate_diet' ? 'Gerar dieta' : 'Abrir dieta'),
    target: canonical === 'open_training' ? 'home_training_card' : 'home_diet_card',
    source: source || 'kronos_central',
    payload: payload && typeof payload === 'object' ? payload : {},
    meta: { inferred_from: 'kronos_central_engine' }
  };
}

function normalizeCentralContract(payload) {
  var normalized = payload && typeof payload === 'object' ? payload : {};
  var intent = normalized.conversationIntent || buildConversationIntent(normalized.action, normalized.workoutPayload || normalized.dietPayload || null);
  if (intent) normalized.conversationIntent = intent;
  if (!Array.isArray(normalized.actions)) {
    normalized.actions = intent ? [{
      type: intent.type,
      label: intent.label,
      target: intent.target,
      payload: intent.payload,
      meta: intent.meta
    }] : [];
  }
  if (!normalized.data || typeof normalized.data !== 'object') normalized.data = { content: [] };
  if (!Array.isArray(normalized.data.content)) normalized.data.content = [];
  normalized.meta = Object.assign({
    canonicalBackend: 'api/chat',
    contract: 'kronos_central_v1'
  }, normalized.meta || {});
  return normalized;
}

function sanitizeDietShape(payload) {
  if (!payload || typeof payload !== 'object') return { payloadType: typeof payload };
  var data = payload.data && typeof payload.data === 'object' ? payload.data : null;
  var content = data && Array.isArray(data.content) ? data.content : [];
  var first = content[0] && typeof content[0] === 'object' ? content[0] : null;
  return {
    success: payload.success,
    type: payload.type,
    messageChars: String(payload.message || '').length,
    dataKeys: data ? Object.keys(data) : [],
    contentLen: content.length,
    firstNodeType: first ? first.type : null,
    firstNodeKeys: first ? Object.keys(first) : []
  };
}

function normalizeDietEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return buildDietErrorPayload();
  if (payload.success === false) return buildDietErrorPayload();
  if (payload.type === 'diet_result' && payload.data && Array.isArray(payload.data.content) && payload.data.content[0] && payload.data.content[0].type === 'diet_result') {
    return payload;
  }
  var incomingData = payload.data && typeof payload.data === 'object' ? payload.data : {};
  var firstNode = Array.isArray(incomingData.content) ? incomingData.content.find(function(node) { return node && typeof node === 'object'; }) : null;
  var planData = (firstNode && firstNode.data) || incomingData.plan || incomingData.diet || payload.plan || payload.diet || {};
  var message = String(payload.message || (firstNode && firstNode.text) || '').trim();
  if (!message && !Object.keys(planData || {}).length) return buildDietErrorPayload();
  return buildDietSuccessPayload(message || 'Dieta montada com sucesso.', planData, incomingData, payload.meta);
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


function isTransientProviderError(err) {
  var text = String(err || '').toLowerCase();
  return /timeout|429|502|503|504|econnreset|socket hang up|temporar/.test(text);
}

function toProviderErrorContract(err, requestMeta) {
  var transient = isTransientProviderError(err);
  return aiContracts.buildAiErrorContract({
    status: transient ? 503 : 500,
    code: transient ? 'PROVIDER_UNAVAILABLE' : 'INVALID_REQUEST',
    state: transient ? 'provider_unavailable' : 'invalid_request',
    message: transient
      ? 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.'
      : 'Não consegui processar esta solicitação no formato enviado.',
    retryable: transient,
    suggestion: transient ? 'Aguarde alguns segundos e tente novamente.' : 'Revise a solicitação e tente novamente.',
    meta: Object.assign({ provider: 'groq', lastError: String(err || 'unknown') }, requestMeta || {})
  });
}


function fireAndForgetMemoryEvent(input) {
  Promise.resolve()
    .then(function() { return userMemory.captureEventAndEnqueue(input); })
    .catch(function(err) {
      console.warn('[user-memory] update_failed', {
        userId: input && input.userId,
        eventType: input && input.eventType,
        requestId: input && input.requestId,
        error: err && err.message ? err.message : String(err || 'unknown')
      });
    });
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
  Promise.resolve(kronosHub.buildKronosContext({ userId: userId, message: userMsg && userMsg.content }))
    .catch(function() { return null; })
    .then(function(kronosContext) {
      var system = TREINO_SYSTEM;
      if (kronosContext) {
        system += '\n\nCONTEXTO REAL DO APP PARA PERSONALIZAÇÃO DO TREINO:\n' + JSON.stringify(kronosContext);
        system += '\n\nREGRAS: use o contexto real disponível; não diga que não tem acesso a treino, dieta ou exames quando o JSON acima marcar o módulo como disponível; não invente dados ausentes.';
      }
      callChat(system, [userMsg], 3000, 0.1, userId, 'chat-treino', function(err, text) {
        if (err) return callback(err);
        try {
          return callback(null, parseWorkout(text || ''));
        } catch (e) {
          return callback('Erro ao gerar treino: resposta inválida da IA.');
        }
      });
    });
}

var DIETA_KRONOS_SYSTEM = [
  'Você é KRONOS, nutricionista clínico-esportivo do KRONIA. Responda SOMENTE com JSON válido, sem texto extra.',
  'FORMATO OBRIGATÓRIO:',
  '{"refeicoes":[{"nome":"string","horario":"string","itens":[{"nome":"string","gramas":0,"calorias":0,"proteina":0,"carbo":0,"gordura":0}]}],"meta":{"calorias":0,"proteina":0,"carbo":0,"gordura":0},"hidratacao":{"litros":0},"observacoes":[]}',
  'REGRAS ABSOLUTAS:',
  '1. PROIBIDO repetir o mesmo alimento mais de uma vez na mesma refeição.',
  '2. PROIBIDO adicionar alimento apenas para fechar número de macro sem justificativa clínica.',
  '3. Almoço/Jantar: proteína principal + base de carbo + leguminosa (quando pertinente) + vegetal.',
  '4. Café da manhã: sólido (pão, tapioca, aveia = carboidrato) + molhado (leite, café com leite = bebida com macros próprios) como itens SEPARADOS.',
  '5. Respeite OBRIGATORIAMENTE a patologia, exames, restrições e preferências do CONTEXTO DO USUÁRIO.',
  '6. Se houver plano alimentar atual no contexto, preserve a estrutura base e ajuste; não reinvente do zero.',
  '7. Só inclua um novo alimento se houver justificativa funcional ou clínica explícita.',
  '8. RESPOSTA: apenas JSON. Nenhum texto antes ou depois.'
].join('\n');

function parseDietaKronos(text) {
  var clean = String(text || '').replace(/```json|```/g, '').trim();
  var s = clean.indexOf('{');
  var e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('sem json');
  var p = JSON.parse(clean.slice(s, e + 1));
  if (!Array.isArray(p.refeicoes) || !p.refeicoes.length) throw new Error('sem refeicoes');
  if (!p.meta || !p.meta.calorias) throw new Error('sem meta');
  return p;
}

function gerarDietaKronos(kronosContext, message, userId, callback) {
  var ctx = kronosContext ? {
    usuario: kronosContext.user,
    treino: kronosContext.treino ? { disponivel: kronosContext.treino.disponivel, volumeSemanal: kronosContext.treino.volumeSemanal } : null,
    exames: kronosContext.exames ? { disponivel: kronosContext.exames.disponivel, biomarcadores: kronosContext.exames.biomarcadores } : null,
    dietaAtual: kronosContext.dieta ? { disponivel: kronosContext.dieta.disponivel, refeicoes: kronosContext.dieta.refeicoes, semantica: kronosContext.dieta.semantica } : null,
    contextoClinico: kronosContext.contextoClinico
  } : {};
  var userMsg = { role: 'user', content: String(message || 'Gere um plano alimentar personalizado para mim.') };
  var system = DIETA_KRONOS_SYSTEM + '\n\nCONTEXTO DO USUÁRIO:\n' + JSON.stringify(ctx);
  callChat(system, [userMsg], 3000, 0.1, userId, 'chat-dieta-kronos', function(err, text) {
    if (err) return callback(err);
    try {
      return callback(null, parseDietaKronos(text || ''));
    } catch (e) {
      return callback('Dieta gerada em formato inválido: ' + e.message);
    }
  });
}

function buildWorkoutSuccessPayload(data, extraMeta, memoryState) {
  var isFailSafe = !!(data && data.failSafe);
  return {
    success: !isFailSafe,
    type: 'workout_primary',
    message: isFailSafe ? 'Treino não gerado por falta de referência válida.' : 'Treino gerado com sucesso.',
    data: {
      content: [{ type: isFailSafe ? 'workout_failsafe' : 'workout_primary', data: data }],
      conversationState: { memory: memoryState || null }
    },
    meta: Object.assign({}, extraMeta || {})
  };
}

function buildReferencedWorkoutFallback(collected, done) {
  Promise.resolve(workoutService.execute('GENERATE_WORKOUT', collected || {}))
    .then(function(result) {
      var plan = result && result.payload && result.payload.plan ? result.payload.plan : null;
      if (plan) return done(null, plan);
      return done(null, workoutBuilder.buildWorkoutPlan(collected || {}));
    })
    .catch(function() {
      return done(null, workoutBuilder.buildWorkoutPlan(collected || {}));
    });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return responseUtil.sendJson(res, 405, { success: false, type: 'error', message: 'Método não permitido.', error: 'METHOD_NOT_ALLOWED', meta: { fallback: true } });
  }

  auth.requireAuth(req, res, function(user) {
    var requestBody = req.body || {};
    var usageCategory = requestBody && (requestBody.isDietDirect || requestBody.isWorkoutDirect) ? 'ai_heavy_operation' : 'chat_light';
    rl.rateLimit(req, res, function() {
      access.buildAccessProfileWithDb(user, function(_accessErr, accessProfile) {
      accessProfile = accessProfile || access.buildAccessProfile(user, { profileLookupPerformed: true, profileIsAdmin: false });

      function runPaidAiCall(executor, done) {
        plans.getQuotaInfo(user.id, function(qErr, quota) {
          if (qErr) {
            var quotaErr = aiContracts.buildAiErrorContract({ status: 503, code: 'PLAN_CHECK_UNAVAILABLE', state: 'provider_unavailable', message: 'Não foi possível validar seu plano agora. Tente novamente em instantes.', retryable: true, suggestion: 'Tente novamente em alguns segundos.', meta: { reason: 'quota_check_failed', usageCategory: usageCategory, requestId: b.requestId || b.correlationId || null } });
            return responseUtil.sendJson(res, quotaErr.status, quotaErr.body);
          }
          if (!quota.allowed) {
            var planLimit = aiContracts.buildAiErrorContract({ status: 402, code: 'LIMIT_REACHED_PLAN', state: 'limit_reached_plan', message: 'Você atingiu o limite diário do seu plano. Faça upgrade para continuar.', retryable: false, action: { type: 'upgrade_plan', label: 'Ver planos' }, meta: { quota: { used: quota.used, limit: quota.limit, plan: quota.plan }, usageCategory: usageCategory, requestId: b.requestId || b.correlationId || null } });
            return responseUtil.sendJson(res, planLimit.status, planLimit.body);
          }

          executor(function(err, payload) {
            if (err) return done(err);
            plans.checkAndIncrementQuota(user.id, res, function() {
              done(null, payload, quota);
            }, { accessProfile: accessProfile });
          }, quota);
        }, { accessProfile: accessProfile });
      }

      var b = requestBody;
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
      fireAndForgetMemoryEvent({
        userId: user.id,
        eventType: 'chat_message',
        eventKey: user.id + ':chat_message:' + (b.requestId || b.correlationId || Date.now()) + ':' + String(lastContent || '').length,
        payload: { note: String(lastContent || '').slice(0, 600), channel: 'chat', intent_hint: 'conversation' },
        requestId: b.requestId || b.correlationId || null,
        component: 'api/chat',
        source: 'chat_api'
      });

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
        var shouldForceDietContract = !!(b && b.isDietDirect) || !!(convState && convState.mode === 'diet') || normalizedPayload.type === 'diet_result';
        if (shouldForceDietContract) {
          console.log('[chat] diet_backend_payload_shape', JSON.stringify({
            event: 'diet_backend_payload_shape',
            stage: 'before_normalize',
            statusCode: statusCode,
            shape: sanitizeDietShape(normalizedPayload)
          }));
          normalizedPayload = normalizeDietEnvelope(normalizedPayload);
          console.log('[chat] diet_backend_payload_shape', JSON.stringify({
            event: 'diet_backend_payload_shape',
            stage: 'after_normalize',
            statusCode: statusCode,
            shape: sanitizeDietShape(normalizedPayload)
          }));
          if (normalizedPayload.success === false) {
            console.warn('[chat] diet_pipeline_failed', JSON.stringify({ event: 'diet_pipeline_failed', statusCode: statusCode, reason: 'diet_contract_normalization_failed' }));
            statusCode = 500;
            outcome = 'failure';
          }
        }
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
            message: 'Não consegui montar a dieta agora. Tente novamente em instantes.',
            error: 'INVALID_INTERNAL_CONTRACT',
            data: { content: [] },
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
        normalizedPayload.requestId = normalizedPayload.requestId || (b.requestId || b.correlationId || null);
        normalizedPayload.meta = Object.assign({}, normalizedPayload.meta || {}, { usageCategory: usageCategory });
        if (user && user.id && !normalizedPayload.userId) normalizedPayload.userId = user.id;

        // Retrocompatibilidade para consumidores que esperam 'reply' ou 'text' no nível superior (ex: motor de alertas)
        if (normalizedPayload.message) {
          normalizedPayload.reply = normalizedPayload.message;
          normalizedPayload.text = normalizedPayload.message;
        }

        tracker.finishExecution(function(err) {
          if (err) console.error('[diagnostics] failed to persist execution', err);
          normalizedPayload = normalizeCentralContract(normalizedPayload);
          return responseUtil.sendJson(res, statusCode, normalizedPayload);
        });
      }

      if (b && b.isWorkoutDirect) {
        var workoutDirectPayload = (b.workoutProfile && typeof b.workoutProfile === 'object')
          ? b.workoutProfile
          : ((b.payload && typeof b.payload === 'object') ? b.payload : {});
        safeTrack(function() { tracker.captureDecision({
          graphNode: 'Treino',
          reason: 'isWorkoutDirect flag routes workout generation through KRONOS central.',
          pipelineSelected: 'workout_direct_service',
          fallbackUsed: false
        }); });
        return runPaidAiCall(function(nextCall) {
          Promise.resolve(workoutService.execute('GENERATE_WORKOUT', workoutDirectPayload))
            .then(function(result) {
              var plan = result && result.payload && result.payload.plan ? result.payload.plan : null;
              if (plan) return nextCall(null, plan);
              return buildReferencedWorkoutFallback(workoutDirectPayload, nextCall);
            })
            .catch(function() {
              return buildReferencedWorkoutFallback(workoutDirectPayload, nextCall);
            });
        }, function(err, data) {
          if (err) {
            var workoutError = toProviderErrorContract(err, { operation: 'workout_direct' });
            return sendTracked(workoutError.status, workoutError.body, 'failure');
          }
          fireAndForgetMemoryEvent({
            userId: user.id,
            eventType: 'workout_generated',
            eventKey: user.id + ':workout_generated:' + (b.requestId || b.correlationId || Date.now()) + ':direct',
            payload: { source: 'kronos_central_direct', sections: Array.isArray(data && data.treinos) ? data.treinos.length : 0 },
            requestId: b.requestId || b.correlationId || null,
            component: 'api/chat',
            source: 'kronos_central'
          });
          return sendTracked(200, buildWorkoutSuccessPayload(data, { local: true, flow: 'workout_direct', canonicalBackend: 'api/chat' }, shortState));
        });
      }

      if (convState && convState.mode === 'diet') {
        console.log('[chat] diet_pipeline_selected', JSON.stringify({ event: 'diet_pipeline_selected', source: 'conversation_state' }));
        safeTrack(function() { tracker.captureDecision({
          graphNode: 'Nutricao',
          reason: 'Continuação de fluxo ativo de dieta.',
          pipelineSelected: 'diet_flow',
          fallbackUsed: true
        }); });
        var dietStep = dietflow.continueDietFlow(convState.stepIndex, convState.collected, lastContent);
        if (!dietStep.finished) {
          safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Nutricao', stepName: diagnosticConstants.STEP_NAMES.DIET_PIPELINE_SELECTED, status: 'success', success: true, inputSummary: lastContent, outputSummary: dietStep.response }); });
          return sendTracked(200, buildDietCollectingPayload(
            dietStep.response,
            { next_step: dietStep.stepIndex },
            { conversationState: { mode: dietStep.mode, stepIndex: dietStep.stepIndex, collected: dietStep.collected, memory: shortState } },
            { local: true, flow: 'diet' }
          ));
        }
        var collectedMsg = 'Gere um plano alimentar personalizado.' + (dietStep.collected ? ' Contexto coletado: ' + JSON.stringify(dietStep.collected) : '');
        return runPaidAiCall(function(nextCall) {
          Promise.resolve(kronosHub.buildKronosContext({ userId: user.id, message: collectedMsg }))
            .catch(function() { return null; })
            .then(function(kronosContext) {
              gerarDietaKronos(kronosContext, collectedMsg, user.id, function(err, kronos_plan) {
                if (err || !kronos_plan) {
                  console.warn('[chat] diet_kronos_failed', JSON.stringify({ event: 'diet_kronos_failed', error: String(err || 'no plan'), source: 'conversation_state' }));
                  return nextCall(null, buildDietErrorPayload());
                }
                safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Nutricao', stepName: 'diet_response_built', status: 'success', success: true, outputSummary: formatDietSummary(kronos_plan) }); });
                console.log('[chat] diet_pipeline_completed', JSON.stringify({ event: 'diet_pipeline_completed', source: 'conversation_state', refeicoes: (kronos_plan.refeicoes || []).length }));
                return nextCall(null, buildDietSuccessPayload(
                  formatDietSummary(kronos_plan),
                  kronos_plan,
                  { conversationState: { memory: shortState } },
                  { flow: 'kronos_diet' }
                ));
              });
            });
        }, function(err, data) {
          if (err) {
            var dcErr = toProviderErrorContract(err, { operation: 'diet_kronos_flow' });
            return sendTracked(dcErr.status, dcErr.body, 'failure');
          }
          return sendTracked(200, data);
        });
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

        if (!process.env.GROQ_API_KEY) {
          return buildReferencedWorkoutFallback(workoutStep.collected, function(_fallbackErr, localWorkout) {
            safeTrack(function() { tracker.addStep({ layer: 'fallback', nodeKey: 'Treino', stepName: diagnosticConstants.STEP_NAMES.LLM_FALLBACK_ACTIVATED, status: 'warning', success: true, outputSummary: 'Treino resolvido via serviço oficial de fallback por ausencia de GROQ_API_KEY.' }); });
            return sendTracked(200, buildWorkoutSuccessPayload(localWorkout, { local: true, fallback: true, source: 'workout_reference_service' }, shortState));
          });
        }

        safeTrack(function() { tracker.startStep(diagnosticConstants.STEP_NAMES.WORKOUT_GENERATION_REQUESTED, { layer: 'ai', nodeKey: 'Treino' }); });
        return runPaidAiCall(function(nextCall) {
          var richMsg = { role: 'user', content: workoutflow.buildWorkoutMessage(workoutStep.collected) };
          gerarTreino(richMsg, user.id, nextCall);
        }, function(err, data) {
          if (err) {
            return buildReferencedWorkoutFallback(workoutStep.collected, function(_fallbackErr, fallbackWorkout) {
              safeTrack(function() {
                tracker.finishStep(diagnosticConstants.STEP_NAMES.WORKOUT_GENERATION_REQUESTED, { success: false, status: 'error', errorCode: 'PROVIDER_UNAVAILABLE', errorMessage: err });
                tracker.addStep({ layer: 'fallback', nodeKey: 'Treino', stepName: diagnosticConstants.STEP_NAMES.LLM_FALLBACK_ACTIVATED, status: 'warning', success: true, outputSummary: 'Treino resolvido via serviço oficial de fallback apos falha do provider.' });
              });
              return sendTracked(200, buildWorkoutSuccessPayload(fallbackWorkout, { local: true, fallback: true, source: 'workout_reference_service', providerError: String(err || '') }, shortState));
            });
          }
          safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.WORKOUT_GENERATION_REQUESTED, { success: true, outputSummary: 'Treino gerado no modo workout_json.' }); });
          fireAndForgetMemoryEvent({
            userId: user.id,
            eventType: 'workout_generated',
            eventKey: user.id + ':workout_generated:' + (b.requestId || b.correlationId || Date.now()) + ':flow',
            payload: { source: 'workout_flow', sections: Array.isArray(data && data.treinos) ? data.treinos.length : 0 },
            requestId: b.requestId || b.correlationId || null,
            component: 'api/chat',
            source: 'workout_pipeline'
          });
          return sendTracked(200, buildWorkoutSuccessPayload(data, {}, shortState));
        });
      }

      var normalized = classifier.normalizeConversationInput(lastContent);
      var continuationContext = conversationStateUtil.applyContinuationContext(normalized, shortState);
      var classification = classifier.classifyIntent(normalized, continuationContext);
      var decision = decisionEngine.decideAction(classification, shortState, b.context || {});
      if (b && b.isDietDirect) {
        classification.topic = 'diet';
        classification.kind = 'request';
        decision.action = 'open_diet_flow';
        decision.reason = 'isDietDirect flag forces diet pipeline.';
      }
      var isDietGenRequest = /\b(monta|montar|cria|criar|gera|gerar|plano alimentar)\b/.test(lastContent);
      if (classification.topic === 'diet' && isDietGenRequest && decision.action !== 'open_diet_flow') {
        decision.action = 'open_diet_flow';
        decision.reason = 'Explicit diet generation request.';
      }
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
        var dietSource = b && b.isDietDirect ? 'isDietDirect' : 'intent_classifier';
        console.log('[chat] diet_pipeline_selected', JSON.stringify({ event: 'diet_pipeline_selected', source: dietSource }));
        emitDecisionTelemetry(user.id, classification, decision, false, true);
        safeTrack(function() { tracker.addStep({ layer: 'flow', nodeKey: 'Nutricao', stepName: diagnosticConstants.STEP_NAMES.DIET_PIPELINE_SELECTED, status: 'success', success: true, outputSummary: 'kronos_diet_generation' }); });
        return runPaidAiCall(function(done) {
          Promise.resolve(kronosHub.buildKronosContext({ userId: user.id, message: lastContent }))
            .catch(function() { return null; })
            .then(function(kronosContext) {
              gerarDietaKronos(kronosContext, lastContent, user.id, function(err, kronos_plan) {
                if (err || !kronos_plan) {
                  console.warn('[chat] diet_kronos_failed', JSON.stringify({ event: 'diet_kronos_failed', error: String(err || 'no plan') }));
                  return done(null, buildDietErrorPayload());
                }
                console.log('[chat] diet_pipeline_completed', JSON.stringify({ event: 'diet_pipeline_completed', source: 'kronos', refeicoes: (kronos_plan.refeicoes || []).length }));
                fireAndForgetMemoryEvent({
                  userId: user.id,
                  eventType: 'diet_generated',
                  eventKey: user.id + ':diet_generated:' + Date.now(),
                  payload: { refeicoes: (kronos_plan.refeicoes || []).length, source: 'kronos' },
                  requestId: b.requestId || b.correlationId || null,
                  component: 'api/chat',
                  source: 'diet_pipeline'
                });
                return done(null, buildDietSuccessPayload(
                  formatDietSummary(kronos_plan),
                  kronos_plan,
                  { conversationState: { memory: nextShortState } },
                  { flow: 'kronos_diet' }
                ));
              });
            });
        }, function(err, data) {
          if (err) {
            var dietKronosErr = toProviderErrorContract(err, { operation: 'diet_kronos' });
            return sendTracked(dietKronosErr.status, dietKronosErr.body, 'failure');
          }
          return sendTracked(200, data);
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
        safeTrack(function() { tracker.addStep({ layer: 'memory', nodeKey: 'Evolucao', stepName: 'progress_memory_resolved', status: 'success', success: true, outputSummary: 'api/chat central memory analysis' }); });
        return userMemory.getProgressAnalysis(user.id)
          .then(function(progress) {
            var msg = progress && progress.explanation ? progress.explanation : 'Ainda não há dados suficientes para análise longitudinal completa.';
            return sendTracked(200, {
              success: true,
              type: 'progress_analysis',
              action: null,
              message: msg,
              data: {
                progress: progress,
                content: [{ type: 'text', text: msg }],
                conversationState: { memory: nextShortState }
              },
              meta: { local: true, source: 'kronos_central_memory', decision: process.env.NODE_ENV === 'development' ? decision : undefined }
            });
          })
          .catch(function(err) {
            var progressError = toProviderErrorContract(err, { operation: 'progress_memory' });
            return sendTracked(progressError.status, progressError.body, 'failure');
          });
      }

      Promise.resolve()
        .then(function() {
          // Build Context Hub + optional science in parallel
          var sciencePromise = (classification.topic !== 'general')
            ? Promise.resolve(scienceInsight.buildScienceContextFromText(lastContent)).catch(function() { return null; })
            : Promise.resolve(null);
          var hubPromise = Promise.resolve(kronosHub.buildKronosContextHub(user.id, lastContent)).catch(function() { return null; });
          return Promise.all([sciencePromise, hubPromise]);
        })
        .then(function(results) {
          var scienceContext = results[0];
          var hub = results[1];

          // Derive kronos intent from classification
          var kronosIntent = kronosHub.deriveKronosIntent(classification.topic, classification.kind);
          var selectedContext = kronosHub.selectContextForIntent(hub, kronosIntent);
          var contextBlock = kronosHub.formatContextForPrompt(selectedContext);

          var context = Object.assign({}, b.context || {});
          if (scienceContext) context.science_context = scienceContext;
          if (contextBlock) context.kronosContextBlock = contextBlock;

          // Legacy fallback: also set coaching_summary if memory is available
          if (hub && hub.memory && hub.memory.coachingSummary) {
            context.coaching_summary = hub.memory.coachingSummary;
          }

          safeTrack(function() { tracker.startStep(diagnosticConstants.STEP_NAMES.LLM_RESPONSE_REQUESTED, { layer: 'ai', nodeKey: 'Recomendacao', inputSummary: lastContent }); });
          safeTrack(function() { tracker.captureMetric({ key: 'promptSizeEstimate', value: String(lastContent || '').length, unit: 'chars' }); });
          safeTrack(function() { tracker.captureMetric({ key: 'kronosIntent', value: kronosIntent }); });
          runPaidAiCall(function(nextCall) {
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && !process.env.GROQ_API_KEY) {
              var workoutStartFallback = workoutflow.startWorkoutFlow();
              return nextCall(null, {
                __localWorkoutFlowStart: true,
                message: workoutStartFallback.response,
                state: workoutStartFallback
              });
            }
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && /\b(monta|cria|gera)\b/.test(classification.sanitizedText)) {
              return gerarTreino({ role: 'user', content: lastContent }, user.id, nextCall);
            }

            var mode = decision.depth || 'short';
            var maxTokens = decision.tokenLimit || decisionEngine.resolveTokenLimit(decision);
            askKronosService.askKronos({
              message: lastContent,
              userId: user.id,
              intent: kronosIntent,
              topic: classification.topic,
              mode: mode,
              maxTokens: maxTokens,
              kronosContext: hub && typeof hub === 'object' ? Object.assign({}, selectedContext, {
                generatedAt: hub.generatedAt || new Date().toISOString(),
                inventory: hub.inventory || {},
                missingData: hub.missingData || [],
                scienceContext: scienceContext || null
              }) : null,
              callLLM: function(payload) {
                return new Promise(function(resolve, reject) {
                  var system = payload.systemPrompt;
                  var llmMessages = messages;
                  callChat(system, llmMessages, maxTokens, 0.35, user.id, 'chat', function(callErr, callPayload) {
                    if (callErr) return reject(callErr);
                    resolve(callPayload);
                  });
                });
              }
            }).then(function(result) {
              nextCall(null, result.response);
            }).catch(function(callErr) {
              nextCall(callErr);
            });
          }, function(err, payload) {
            if (err) {
              safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.LLM_RESPONSE_REQUESTED, { success: false, status: 'error', errorCode: 'PROVIDER_UNAVAILABLE', errorMessage: err }); });
              safeTrack(function() { tracker.addStep({ layer: 'fallback', nodeKey: 'Alerta', stepName: diagnosticConstants.STEP_NAMES.LLM_FALLBACK_ACTIVATED, status: 'warning', success: false, errorCode: 'PROVIDER_UNAVAILABLE', decisionReason: 'LLM indisponível no endpoint principal.' }); });
              var providerError = toProviderErrorContract(err, { operation: 'chat_llm' });
              return sendTracked(providerError.status, providerError.body, 'failure');
            }
            safeTrack(function() { tracker.finishStep(diagnosticConstants.STEP_NAMES.LLM_RESPONSE_REQUESTED, { success: true, outputSummary: typeof payload === 'string' ? payload : 'workout_json_payload' }); });
            safeTrack(function() { tracker.captureMetric({ key: 'llmCalled', value: true }); });
            safeTrack(function() { tracker.captureMetric({ key: 'responseSizeEstimate', value: typeof payload === 'string' ? payload.length : JSON.stringify(payload || {}).length, unit: 'chars' }); });
            emitDecisionTelemetry(user.id, classification, decision, true, false);
            if (payload && payload.__localWorkoutFlowStart) {
              return sendTracked(200, {
                success: true,
                type: 'text',
                action: 'open_workout_flow',
                message: payload.message,
                data: { conversationState: { mode: payload.state.mode, stepIndex: payload.state.stepIndex, collected: payload.state.collected, memory: nextShortState } },
                meta: { local: true, fallback: true, source: 'workout_flow_start_no_provider' }
              });
            }
            if (decision.action === 'call_llm_full' && classification.topic === 'workout' && typeof payload === 'object') {
              fireAndForgetMemoryEvent({
                userId: user.id,
                eventType: 'workout_generated',
                eventKey: user.id + ':workout_generated:' + (b.requestId || b.correlationId || Date.now()) + ':llm',
                payload: { source: 'llm_full', sections: Array.isArray(payload && payload.treinos) ? payload.treinos.length : 0 },
                requestId: b.requestId || b.correlationId || null,
                component: 'api/chat',
                source: 'llm'
              });
              return sendTracked(200, buildWorkoutSuccessPayload(payload, {}, nextShortState));
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
          var providerError = toProviderErrorContract(err, { operation: 'chat_promise' });
          return sendTracked(providerError.status, providerError.body, 'failure');
        });

      });
    }, { max: 24, windowMs: 60000, category: usageCategory }, user.id);
  });
};
