var cors = require('../apihelpers/_cors');
var auth = require('../apihelpers/_auth');
var plans = require('../apihelpers/_plans');
var adminGuard = require('../apihelpers/_adminGuard');
var diagnostics = require('../apihelpers/_diagnosticTracker');
var classifier = require('../apihelpers/_conversationClassifier');
var decisionEngine = require('../apihelpers/_decisionEngine');
var healthRules = require('../apihelpers/_diagnosticHealth');
var constants = require('../apihelpers/_diagnosticConstants');

var VALID_ACTIONS_GET = ['overview', 'recent', 'execution', 'health', 'alerts', 'node_stats', 'checklist', 'journey', 'export'];
var VALID_ACTIONS_POST = ['simulate', 'health'];

function sendOk(res, data, statusCode) {
  return res.status(statusCode || 200).json({ success: true, data: data || {}, error: null });
}

function sendError(res, code, message, statusCode, details) {
  return res.status(statusCode || 400).json({ success: false, data: null, error: { code: code, message: message, details: details || null } });
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

function parseSimulationFlags(body) {
  body = body || {};
  return {
    dryRun: body.dry_run !== false && body.dryRun !== false,
    simulationMode: String(body.simulation_mode || body.simulationMode || 'standard'),
    forceErrorType: String(body.force_error_type || body.forceErrorType || '').toLowerCase(),
    disablePersistence: !!(body.disable_persistence || body.disablePersistence),
    forceNoContext: !!(body.force_no_context || body.forceNoContext),
    forceLlmFailure: !!(body.force_llm_failure || body.forceLlmFailure),
    forceDbFailure: !!(body.force_db_failure || body.forceDbFailure)
  };
}

function query(path) {
  return new Promise(function(resolve, reject) {
    plans.supabaseRequest('GET', path, null, function(err, rows) {
      if (err) return reject(err);
      return resolve(rows || []);
    });
  });
}

function num(value, fallback, min, max) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (min != null && parsed < min) parsed = min;
  if (max != null && parsed > max) parsed = max;
  return parsed;
}

function buildRecentQuery(queryObj) {
  queryObj = queryObj || {};
  var page = num(queryObj.page, 1, 1, 10000);
  var pageSize = num(queryObj.page_size || queryObj.pageSize, 40, 1, 200);
  var offset = (page - 1) * pageSize;
  var filters = [];

  if (queryObj.user_id) filters.push('user_id=eq.' + encodeURIComponent(String(queryObj.user_id)));
  if (queryObj.intent) filters.push('intent_detected=eq.' + encodeURIComponent(String(queryObj.intent)));
  if (queryObj.pipeline) filters.push('pipeline_selected=eq.' + encodeURIComponent(String(queryObj.pipeline)));
  if (queryObj.severity) filters.push('severity=eq.' + encodeURIComponent(String(queryObj.severity)));
  if (queryObj.simulation_mode) filters.push('source=eq.admin_test');
  if (queryObj.success === 'true' || queryObj.success === 'false') filters.push('success=eq.' + queryObj.success);
  if (queryObj.fallback === 'true' || queryObj.fallback === 'false') filters.push('fallback_used=eq.' + queryObj.fallback);
  if (queryObj.correlation_id) filters.push('correlation_id=eq.' + encodeURIComponent(String(queryObj.correlation_id)));
  if (queryObj.conversation_trace_id) filters.push('conversation_trace_id=eq.' + encodeURIComponent(String(queryObj.conversation_trace_id)));

  var base = 'diagnostic_executions?select=execution_id,correlation_id,conversation_trace_id,parent_execution_id,user_id,source,input_type,raw_input_summary,normalized_input_summary,intent_detected,intent_confidence,pipeline_selected,fallback_used,duration_ms,final_status,success,severity,diagnostic_quality_score,created_at,decision_reason,response_summary,graph_path&order=created_at.desc&limit=' + pageSize + '&offset=' + offset;
  return {
    query: filters.length ? (base + '&' + filters.join('&')) : base,
    page: page,
    pageSize: pageSize
  };
}

function buildImpactRanking(executions) {
  var byComponent = {};
  (executions || []).forEach(function(item) {
    var key = item.pipeline_selected || 'unknown';
    if (!byComponent[key]) byComponent[key] = { component: key, failures: 0, lowQuality: 0, fallback: 0, impact: 0 };
    if (item.success === false) byComponent[key].failures += 1;
    if (Number(item.diagnostic_quality_score || 100) < 55) byComponent[key].lowQuality += 1;
    if (item.fallback_used) byComponent[key].fallback += 1;
    byComponent[key].impact = byComponent[key].failures * 3 + byComponent[key].lowQuality * 2 + byComponent[key].fallback;
  });
  return Object.keys(byComponent).map(function(key) {
    var row = byComponent[key];
    row.impactBand = row.impact >= 20 ? 'critical' : (row.impact >= 10 ? 'high' : (row.impact >= 5 ? 'medium' : 'low'));
    return row;
  }).sort(function(a, b) { return b.impact - a.impact; });
}

function fetchExecutionDetail(executionId) {
  var encodedId = encodeURIComponent(executionId);
  return Promise.all([
    query('diagnostic_executions?execution_id=eq.' + encodedId + '&select=*'),
    query('diagnostic_steps?execution_id=eq.' + encodedId + '&select=*&order=step_order.asc')
  ]).then(function(result) {
    return { execution: result[0] && result[0][0] ? result[0][0] : null, steps: result[1] || [] };
  });
}

function mapNodeStats(stepRows) {
  var stats = {};
  (stepRows || []).forEach(function(step) {
    var node = step.node_key || 'unknown';
    if (!stats[node]) stats[node] = { node: node, total: 0, failures: 0, avgDurationMs: 0, lastError: null };
    stats[node].total += 1;
    if (step.success === false) {
      stats[node].failures += 1;
      stats[node].lastError = step.error_message || step.error_code || stats[node].lastError;
    }
    stats[node].avgDurationMs += Number(step.duration_ms || 0);
  });
  return Object.keys(stats).map(function(node) {
    var item = stats[node];
    item.avgDurationMs = item.total ? Math.round(item.avgDurationMs / item.total) : 0;
    item.successRate = item.total ? Number(((item.total - item.failures) / item.total).toFixed(3)) : 1;
    return item;
  });
}

function buildChecklist(executions) {
  var list = executions || [];
  function has(predicate) { return list.some(predicate); }
  return [
    { key: 'greeting_short', label: 'Saudação curta correta', ok: has(function(x) { return (x.intent_detected || '').indexOf('greeting') >= 0 && !x.fallback_used; }) },
    { key: 'workout_vs_diet', label: 'Treino x dieta diferenciados', ok: has(function(x) { return x.pipeline_selected === 'open_workout_flow'; }) && has(function(x) { return x.pipeline_selected === 'open_diet_flow'; }) },
    { key: 'supplement_route', label: 'Suplementação roteada sem cair em treino', ok: has(function(x) { return (x.intent_detected || '').indexOf('supplement') >= 0 && x.pipeline_selected !== 'open_workout_flow'; }) },
    { key: 'fallback_visible', label: 'Fallback visível quando há falha', ok: has(function(x) { return x.fallback_used === true; }) },
    { key: 'graph_reflects_execution', label: 'Grafo reflete execução real', ok: has(function(x) { return !!x.graph_path; }) },
    { key: 'replay_coherent', label: 'Replay técnico coerente', ok: has(function(x) { return !!x.decision_reason && !!x.raw_input_summary; }) },
    { key: 'quality_score_present', label: 'Score de qualidade presente', ok: has(function(x) { return x.diagnostic_quality_score != null; }) },
    { key: 'cost_signal_present', label: 'Sinal de custo monitorado', ok: has(function(x) { return x.metadata && x.metadata.estimated_cost_band; }) }
  ];
}

async function runSimulation(user, accessProfile, reqBody) {
  var text = String(reqBody.text || 'oi').trim();
  var scenario = String(reqBody.scenario || 'custom').trim();
  var flags = parseSimulationFlags(reqBody);

  var tracker = new diagnostics.DiagnosticTracker({
    userId: user.id,
    isAdminMode: true,
    source: 'admin_test',
    inputType: 'simulation',
    correlationId: reqBody.correlation_id || null,
    conversationTraceId: reqBody.conversation_trace_id || ('admin-sim-' + user.id),
    parentExecutionId: reqBody.parent_execution_id || null,
    rawInput: text,
    metadata: {
      scenario: scenario,
      dryRun: flags.dryRun,
      forceErrorType: flags.forceErrorType
    }
  });

  tracker.startExecution();
  tracker.addStep({ layer: 'input', nodeKey: 'Usuario', stepName: constants.STEP_NAMES.INPUT_RECEIVED, status: 'success', success: true, inputSummary: text });

  var normalized = classifier.normalizeConversationInput(text);
  var classification = classifier.classifyIntent(normalized, flags.forceNoContext ? null : reqBody.context || null);
  var decision = decisionEngine.decideAction(classification, null, {});

  tracker.addStep({
    layer: 'classification',
    nodeKey: 'Recomendacao',
    stepName: constants.STEP_NAMES.INTENT_CLASSIFIED,
    status: 'success',
    success: true,
    inputSummary: normalized.reducedText,
    outputSummary: classification.kind + ' · ' + classification.topic,
    decisionReason: 'confidence=' + Number(classification.confidence || 0).toFixed(2)
  });

  tracker.captureDecision({
    graphNode: constants.NODE_KEY_MAP[decision.action] || 'Recomendacao',
    intentDetected: classification.kind || classification.topic,
    intentConfidence: classification.confidence,
    pipelineSelected: decision.action,
    reason: decision.reason || ('decision=' + decision.action),
    fallbackUsed: decision.action !== 'call_llm_full',
    inputSummary: text,
    outputSummary: decision.action,
    metadata: {
      raw_input: text,
      normalized_input: normalized.reducedText,
      detected_intent: classification.kind,
      confidence: classification.confidence,
      selected_pipeline: decision.action,
      llm_required: decision.action.indexOf('call_llm') === 0
    }
  });

  if (flags.forceLlmFailure || flags.forceErrorType === 'llm') {
    tracker.addStep({
      layer: 'fallback',
      nodeKey: 'Alerta',
      stepName: constants.STEP_NAMES.LLM_FALLBACK_ACTIVATED,
      status: 'warning',
      success: false,
      errorCode: 'FORCED_LLM_FAILURE',
      decisionReason: 'Falha forçada para validação de fallback.'
    });
    tracker.markFailure({ finalStatus: 'simulated_failure', errorCode: 'FORCED_LLM_FAILURE', errorMessage: 'Simulação de falha de IA.' });
  } else {
    tracker.markSuccess({
      finalStatus: 'simulated_success',
      responseSummary: 'Cenário ' + scenario + ' executado em modo ' + flags.simulationMode + (flags.dryRun ? ' (dry-run).' : '.')
    });
  }
  tracker.captureQualityFlags({
    intent: classification.kind,
    pipelineSelected: decision.action,
    llmCalled: decision.action.indexOf('call_llm') === 0,
    fallbackUsed: !!(flags.forceLlmFailure || flags.forceErrorType === 'llm'),
    localReplyEligible: decision.action === 'local_reply',
    responseSizeEstimate: text.length,
    promptSizeEstimate: text.length,
    lowConfidence: classification.confidence < 0.62
  });

  if (flags.disablePersistence || flags.forceDbFailure || flags.forceErrorType === 'db') {
    return {
      simulated: true,
      persisted: false,
      scenario: scenario,
      accessSource: accessProfile.source,
      flags: flags,
      decision: {
        intent: classification.kind || classification.topic,
        confidence: classification.confidence,
        action: decision.action,
        reason: decision.reason || null
      },
      report: tracker.exportExecutionReport('json')
    };
  }

  return new Promise(function(resolve) {
    tracker.finishExecution(function(err, result) {
      resolve({
        simulated: true,
        persisted: !err,
        scenario: scenario,
        accessSource: accessProfile.source,
        flags: flags,
        error: err || null,
        decision: {
          intent: classification.kind || classification.topic,
          confidence: classification.confidence,
          action: decision.action,
          reason: decision.reason || null
        },
        report: result && result.summary ? result.summary : tracker.exportExecutionReport('json').summary
      });
    });
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  auth.requireAuth(req, res, function(user) {
    adminGuard.requireAdminAsync(user, res, function(accessProfile) {
    if (!accessProfile) return;

    var action = String((req.query && req.query.action) || '').toLowerCase();

    if (req.method === 'GET' && VALID_ACTIONS_GET.indexOf(action) < 0) {
      return sendError(res, 'INVALID_ACTION', 'Ação GET inválida.', 400, { validActions: VALID_ACTIONS_GET });
    }
    if (req.method === 'POST' && VALID_ACTIONS_POST.indexOf(action) < 0) {
      return sendError(res, 'INVALID_ACTION', 'Ação POST inválida.', 400, { validActions: VALID_ACTIONS_POST });
    }

    if (req.method === 'GET') {
      if (action === 'overview') {
        return query('diagnostic_execution_health?select=*').then(function(rows) {
          var items = (rows || []).map(function(row) { return healthRules.evaluateComponentHealth(row); });
          return sendOk(res, { items: items, thresholds: healthRules.DEFAULT_THRESHOLDS });
        }).catch(function(err) { return sendError(res, 'OVERVIEW_FAILED', 'Falha ao carregar visão geral.', 500, String(err)); });
      }

      if (action === 'recent') {
        var recentCfg = buildRecentQuery(req.query || {});
        return query(recentCfg.query).then(function(rows) {
          return sendOk(res, { executions: rows || [], page: recentCfg.page, pageSize: recentCfg.pageSize });
        }).catch(function(err) { return sendError(res, 'RECENT_FAILED', 'Falha ao listar execuções.', 500, String(err)); });
      }

      if (action === 'execution') {
        var executionId = String((req.query && req.query.execution_id) || '').trim();
        if (!executionId) return sendError(res, 'EXECUTION_ID_REQUIRED', 'execution_id é obrigatório.', 400);
        return fetchExecutionDetail(executionId).then(function(detail) {
          if (!detail.execution) return sendError(res, 'NOT_FOUND', 'Execução não encontrada.', 404);
          var nodeStats = mapNodeStats(detail.steps);
          return sendOk(res, { execution: detail.execution, steps: detail.steps, nodeStats: nodeStats });
        }).catch(function(err) { return sendError(res, 'EXECUTION_FAILED', 'Falha ao carregar execução.', 500, String(err)); });
      }

      if (action === 'health') {
        return Promise.all([
          query('diagnostic_executions?select=duration_ms,success,fallback_used,created_at&order=created_at.desc&limit=200'),
          query('diagnostic_execution_health?select=*')
        ]).then(function(result) {
          var recentRows = result[0] || [];
          var items = (result[1] || []).map(function(row) { return healthRules.evaluateComponentHealth(row); });
          var alerts = healthRules.buildAlerts(recentRows);
          return sendOk(res, {
            checks: [
              { key: 'supabase_connection', label: 'Conexão Supabase', status: 'healthy', message: 'Banco conectado com sucesso.' },
              { key: 'diagnostic_read', label: 'Leitura diagnóstica', status: 'healthy', message: 'Leitura da observabilidade disponível.' },
              { key: 'intent_router', label: 'Classificador + roteador', status: 'healthy', message: 'Classificador e decision engine disponíveis.' },
              { key: 'ai_provider', label: 'Provider IA', status: process.env.GROQ_API_KEY ? 'healthy' : 'warning', message: process.env.GROQ_API_KEY ? 'GROQ_API_KEY configurada.' : 'GROQ_API_KEY ausente; fallback local pode ser usado.' }
            ],
            overview: items,
            alerts: alerts,
            thresholds: healthRules.DEFAULT_THRESHOLDS
          });
        }).catch(function(err) { return sendError(res, 'HEALTH_FAILED', 'Falha ao executar health checks.', 500, String(err)); });
      }

      if (action === 'alerts') {
        return query('diagnostic_executions?select=execution_id,success,fallback_used,duration_ms,pipeline_selected,diagnostic_quality_score,created_at&order=created_at.desc&limit=120').then(function(rows) {
          return sendOk(res, { alerts: healthRules.buildAlerts(rows || []), impactRanking: buildImpactRanking(rows || []) });
        }).catch(function(err) { return sendError(res, 'ALERTS_FAILED', 'Falha ao calcular alertas.', 500, String(err)); });
      }

      if (action === 'node_stats') {
        return query('diagnostic_steps?select=node_key,success,duration_ms,error_code,error_message,created_at&order=created_at.desc&limit=500').then(function(rows) {
          return sendOk(res, { nodeStats: mapNodeStats(rows) });
        }).catch(function(err) { return sendError(res, 'NODE_STATS_FAILED', 'Falha ao calcular métricas por nó.', 500, String(err)); });
      }

      if (action === 'checklist') {
        return query('diagnostic_executions?select=intent_detected,pipeline_selected,fallback_used,graph_path,decision_reason,raw_input_summary,diagnostic_quality_score,metadata&order=created_at.desc&limit=100').then(function(rows) {
          return sendOk(res, { checklist: buildChecklist(rows) });
        }).catch(function(err) { return sendError(res, 'CHECKLIST_FAILED', 'Falha ao montar checklist.', 500, String(err)); });
      }

      if (action === 'journey') {
        var traceId = String((req.query && req.query.conversation_trace_id) || '').trim();
        if (!traceId) return sendError(res, 'TRACE_ID_REQUIRED', 'conversation_trace_id é obrigatório.', 400);
        return query('diagnostic_executions?conversation_trace_id=eq.' + encodeURIComponent(traceId) + '&select=execution_id,parent_execution_id,correlation_id,intent_detected,pipeline_selected,success,fallback_used,severity,diagnostic_quality_score,created_at&order=created_at.asc&limit=300').then(function(rows) {
          return sendOk(res, { journey: rows || [], conversationTraceId: traceId });
        }).catch(function(err) { return sendError(res, 'JOURNEY_FAILED', 'Falha ao carregar jornada.', 500, String(err)); });
      }

      if (action === 'export') {
        var executionIdForExport = String((req.query && req.query.execution_id) || '').trim();
        var format = String((req.query && req.query.format) || 'json').toLowerCase();
        if (!executionIdForExport) return sendError(res, 'EXECUTION_ID_REQUIRED', 'execution_id é obrigatório para export.', 400);
        return fetchExecutionDetail(executionIdForExport).then(function(detail) {
          if (!detail.execution) return sendError(res, 'NOT_FOUND', 'Execução não encontrada.', 404);
          var tracker = new diagnostics.DiagnosticTracker({ executionId: detail.execution.execution_id, userId: detail.execution.user_id || null });
          tracker.execution = detail.execution;
          tracker._steps = detail.steps || [];
          var report = tracker.exportExecutionReport(format === 'text' ? 'text' : 'json');
          return sendOk(res, { format: format, report: report });
        }).catch(function(err) { return sendError(res, 'EXPORT_FAILED', 'Falha ao exportar relatório.', 500, String(err)); });
      }
    }

    if (req.method === 'POST') {
      if (action === 'health') {
        return Promise.all([
          query('diagnostic_executions?select=duration_ms,success,fallback_used,created_at&order=created_at.desc&limit=200'),
          query('diagnostic_execution_health?select=*')
        ]).then(function(result) {
          var recentRows = result[0] || [];
          var items = (result[1] || []).map(function(row) { return healthRules.evaluateComponentHealth(row); });
          var alerts = healthRules.buildAlerts(recentRows);
          return sendOk(res, { overview: items, alerts: alerts, thresholds: healthRules.DEFAULT_THRESHOLDS });
        }).catch(function(err) { return sendError(res, 'HEALTH_FAILED', 'Falha ao executar health checks.', 500, String(err)); });
      }

      if (action === 'simulate') {
        var body = parseBody(req);
        return runSimulation(user, accessProfile, body).then(function(payload) {
          return sendOk(res, payload, 200);
        }).catch(function(err) {
          return sendError(res, 'SIMULATION_FAILED', 'Falha na simulação.', 500, String(err));
        });
      }
    }

    return sendError(res, 'METHOD_NOT_ALLOWED', 'Método não permitido.', 405);
    });
  });
};
