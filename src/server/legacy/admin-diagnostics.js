var cors = require('../apihelpers/_cors');
var auth = require('../apihelpers/_auth');
var plans = require('../apihelpers/_plans');
var adminGuard = require('../apihelpers/_adminGuard');
var diagnostics = require('../apihelpers/_diagnosticTracker');
var classifier = require('../apihelpers/_conversationClassifier');
var decisionEngine = require('../apihelpers/_decisionEngine');
var healthRules = require('../apihelpers/_diagnosticHealth');
var constants = require('../apihelpers/_diagnosticConstants');

var VALID_ACTIONS_GET = ['overview', 'recent', 'execution', 'health', 'alerts', 'node_stats', 'checklist', 'journey', 'journeys', 'export', 'exercise_catalog'];
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
      if (Array.isArray(rows)) return resolve(rows);
      if (!rows) return resolve([]);
      return resolve([rows]);
    });
  });
}

var EXECUTION_BASE_FIELDS = [
  'execution_id',
  'parent_execution_id',
  'user_id',
  'source',
  'input_type',
  'raw_input_summary',
  'normalized_input_summary',
  'intent_detected',
  'intent_confidence',
  'pipeline_selected',
  'fallback_used',
  'duration_ms',
  'final_status',
  'success',
  'severity',
  'created_at',
  'decision_reason',
  'response_summary',
  'graph_path'
];
var EXECUTION_OPTIONAL_FIELDS = ['conversation_trace_id', 'correlation_id', 'diagnostic_quality_score', 'metadata'];

function isMissingColumn42703(err) {
  var text = normalizeError(err);
  return text.indexOf('42703') >= 0 || /does not exist/i.test(text);
}

function parseMissingColumn(err) {
  var text = normalizeError(err);
  var match = text.match(/column\s+"?([a-z_]+)"?\s+(?:of relation\s+"diagnostic_executions"\s+)?does not exist/i)
    || text.match(/diagnostic_executions\.([a-z_]+)\s+does not exist/i);
  return match ? match[1] : null;
}

function buildExecutionSelect(includeOptional) {
  return (includeOptional ? EXECUTION_BASE_FIELDS.concat(EXECUTION_OPTIONAL_FIELDS) : EXECUTION_BASE_FIELDS).join(',');
}

function logQueryDegraded(blockName, missingColumn, fallbackSelect) {
  console.warn('[admin-diagnostics] observability_query_degraded', JSON.stringify({
    event: 'observability_query_degraded',
    block: blockName,
    missing_column: missingColumn || null,
    fallback_applied: true,
    fallback_select: fallbackSelect
  }));
}

function queryDiagnosticExecutions(blockName, queryBuilder, options) {
  var cfg = options || {};
  var allowBaseFallback = cfg.allowBaseFallback !== false;
  var optionalDisabled = !!cfg.forceBaseOnly;
  var selectPreferred = buildExecutionSelect(!optionalDisabled);
  var selectBase = buildExecutionSelect(false);
  var firstPath = queryBuilder(selectPreferred);
  return query(firstPath).catch(function(err) {
    if (!allowBaseFallback || optionalDisabled || !isMissingColumn42703(err)) throw err;
    var missingColumn = parseMissingColumn(err);
    logQueryDegraded(blockName, missingColumn, selectBase);
    return query(queryBuilder(selectBase)).then(function(rows) {
      return (rows || []).map(function(row) {
        return Object.assign({ conversation_trace_id: null, correlation_id: null, diagnostic_quality_score: null, metadata: null }, row || {});
      });
    });
  });
}

function normalizeError(err) {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  try { return JSON.stringify(err); } catch (e) { return String(err); }
}

function safeParseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch (e) { return fallback; }
}

function safeExec(actionName, runner, fallbackValue) {
  return Promise.resolve().then(runner).then(function(result) {
    return { value: result, error: null };
  }).catch(function(err) {
    var normalized = normalizeError(err);
    console.error('[admin-diagnostics][' + actionName + '] erro parcial:', normalized);
    return { value: fallbackValue, error: normalized };
  });
}


function buildExerciseCatalogSummary(rows) {
  var list = rows || [];
  var summary = {
    total: list.length,
    with_video: 0,
    with_gif: 0,
    text_only: 0,
    with_instructions: 0,
    with_common_errors: 0,
    with_breathing_tip: 0,
    low_completeness: 0,
    low_media_confidence: 0,
    low_content_value_count: 0,
    low_completeness_count: 0,
    low_media_confidence_count: 0,
    with_instructions_count: 0,
    with_common_errors_count: 0,
    with_breathing_tip_count: 0
  };
  list.forEach(function(item) {
    var mediaType = String(item.media_type || '').toLowerCase();
    var hasVideo = mediaType === 'video' && !!item.media_url;
    var hasGif = mediaType === 'gif' || (!hasVideo && !!item.gif_url);
    if (hasVideo) summary.with_video += 1;
    if (hasGif) summary.with_gif += 1;
    if (!hasVideo && !hasGif) summary.text_only += 1;
    if (Array.isArray(item.instructions) && item.instructions.length) summary.with_instructions += 1;
    if (Array.isArray(item.common_errors) && item.common_errors.length) summary.with_common_errors += 1;
    if (item.breathing_tip) summary.with_breathing_tip += 1;
    if (Number(item.completeness_score || 0) < 55) summary.low_completeness += 1;
    if (Number(item.media_confidence_score || 0) < 0.5) summary.low_media_confidence += 1;
    if ((Array.isArray(item.quality_flags) && item.quality_flags.indexOf('low_content_value') >= 0) || Number(item.completeness_score || 0) < 55) summary.low_content_value_count += 1;
  });
  summary.low_completeness_count = summary.low_completeness;
  summary.low_media_confidence_count = summary.low_media_confidence;
  summary.with_instructions_count = summary.with_instructions;
  summary.with_common_errors_count = summary.with_common_errors;
  summary.with_breathing_tip_count = summary.with_breathing_tip;
  return summary;
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
  // correlation_id é opcional e pode não existir em instalações antigas.
  if (queryObj.conversation_trace_id) filters.push('conversation_trace_id=eq.' + encodeURIComponent(String(queryObj.conversation_trace_id)));

  var base = 'diagnostic_executions?select={SELECT_FIELDS}&order=created_at.desc&limit=' + pageSize + '&offset=' + offset;
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
    queryDiagnosticExecutions('execution_detail', function(selectFields) {
      return 'diagnostic_executions?execution_id=eq.' + encodedId + '&select=' + selectFields;
    }),
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
    { key: 'quality_score_present', label: 'Score de qualidade (opcional) presente', ok: has(function(x) { return x.diagnostic_quality_score != null; }) || !list.length },
    { key: 'cost_signal_present', label: 'Sinal de custo monitorado', ok: has(function(x) { return safeParseJson(x.metadata, {}).estimated_cost_band; }) }
  ];
}

function buildObservabilityPayload(req) {
  var recentCfg = buildRecentQuery(req.query || {});
  var journeyTraceId = String((req.query && req.query.conversation_trace_id) || '').trim();

  return Promise.all([
    safeExec('overview', function() {
      return query('diagnostic_execution_health?select=*').then(function(rows) {
        return (rows || []).map(function(row) { return healthRules.evaluateComponentHealth(row || {}); });
      });
    }, null),
    safeExec('recent', function() {
      return queryDiagnosticExecutions('overview_recent', function(selectFields) {
        return recentCfg.query.replace('{SELECT_FIELDS}', selectFields);
      });
    }, []),
    safeExec('journeys', function() {
      if (!journeyTraceId) return [];
      return queryDiagnosticExecutions('overview_journeys', function(selectFields) {
        return 'diagnostic_executions?conversation_trace_id=eq.' + encodeURIComponent(journeyTraceId) + '&select=' + selectFields + '&order=created_at.asc&limit=300';
      });
    }, []),
    safeExec('node_stats', function() {
      return query('diagnostic_steps?select=node_key,success,duration_ms,error_code,error_message,created_at&order=created_at.desc&limit=500').then(function(rows) {
        return mapNodeStats(rows);
      });
    }, []),
    safeExec('alerts', function() {
      return queryDiagnosticExecutions('overview_alerts', function(selectFields) {
        return 'diagnostic_executions?select=' + selectFields + '&order=created_at.desc&limit=120';
      }).then(function(rows) {
        return healthRules.buildAlerts(rows || []);
      });
    }, []),
    safeExec('checklist', function() {
      return queryDiagnosticExecutions('overview_checklist', function(selectFields) {
        return 'diagnostic_executions?select=' + selectFields + '&order=created_at.desc&limit=100';
      }).then(function(rows) {
        return buildChecklist(rows);
      });
    }, []),
    safeExec('exercise_catalog', function() {
      return query('exercises?select=id,media_type,media_url,gif_url,instructions,common_errors,breathing_tip,completeness_score,media_confidence_score,quality_flags,is_active&is_active=eq.true&limit=2000').then(function(rows) {
        return buildExerciseCatalogSummary(rows);
      });
    }, null)
  ]).then(function(result) {
    return {
      data: {
        overview: result[0].value,
        recent: result[1].value,
        journeys: result[2].value,
        node_stats: result[3].value,
        alerts: result[4].value,
        checklist: result[5].value,
        exercise_catalog: result[6].value
      },
      errors: {
        overview: result[0].error,
        recent: result[1].error,
        journeys: result[2].error,
        node_stats: result[3].error,
        alerts: result[4].error,
        checklist: result[5].error,
        exercise_catalog: result[6].error
      },
      page: recentCfg.page,
      pageSize: recentCfg.pageSize
    };
  });
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
        return buildObservabilityPayload(req).then(function(payload) {
          return sendOk(res, {
            overview: payload.data.overview,
            recent: payload.data.recent,
            journeys: payload.data.journeys,
            node_stats: payload.data.node_stats,
            alerts: payload.data.alerts,
            checklist: payload.data.checklist,
            exercise_catalog: payload.data.exercise_catalog,
            errors: payload.errors,
            page: payload.page,
            pageSize: payload.pageSize,
            thresholds: healthRules.DEFAULT_THRESHOLDS
          });
        }).catch(function(err) {
          return sendError(res, 'OVERVIEW_UNAVAILABLE', 'Observabilidade indisponível.', 500, normalizeError(err));
        });
      }

      if (action === 'recent') {
        var recentCfg = buildRecentQuery(req.query || {});
        return safeExec('recent', function() {
          return queryDiagnosticExecutions('recent', function(selectFields) {
            return recentCfg.query.replace('{SELECT_FIELDS}', selectFields);
          });
        }, []).then(function(outcome) {
          return sendOk(res, { executions: outcome.value, page: recentCfg.page, pageSize: recentCfg.pageSize, errors: { recent: outcome.error } });
        });
      }

      if (action === 'execution') {
        var executionId = String((req.query && req.query.execution_id) || '').trim();
        if (!executionId) return sendError(res, 'EXECUTION_ID_REQUIRED', 'execution_id é obrigatório.', 400);
        return safeExec('execution', function() { return fetchExecutionDetail(executionId); }, { execution: null, steps: [] }).then(function(outcome) {
          if (!outcome.value.execution) return sendError(res, 'NOT_FOUND', 'Execução não encontrada.', 404);
          var nodeStats = mapNodeStats(outcome.value.steps);
          return sendOk(res, { execution: outcome.value.execution, steps: outcome.value.steps, nodeStats: nodeStats, errors: { execution: outcome.error } });
        });
      }

      if (action === 'health') {
        return Promise.all([
          queryDiagnosticExecutions('health_recent', function(selectFields) { return 'diagnostic_executions?select=' + selectFields + '&order=created_at.desc&limit=200'; }),
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
        return safeExec('alerts', function() {
          return queryDiagnosticExecutions('alerts', function(selectFields) {
            return 'diagnostic_executions?select=' + selectFields + '&order=created_at.desc&limit=120';
          });
        }, []).then(function(outcome) {
          return sendOk(res, { alerts: healthRules.buildAlerts(outcome.value || []), impactRanking: buildImpactRanking(outcome.value || []), errors: { alerts: outcome.error } });
        });
      }

      if (action === 'node_stats') {
        return safeExec('node_stats', function() {
          return query('diagnostic_steps?select=node_key,success,duration_ms,error_code,error_message,created_at&order=created_at.desc&limit=500');
        }, []).then(function(outcome) {
          return sendOk(res, { nodeStats: mapNodeStats(outcome.value), errors: { node_stats: outcome.error } });
        });
      }

      if (action === 'checklist') {
        return safeExec('checklist', function() {
          return queryDiagnosticExecutions('checklist', function(selectFields) {
            return 'diagnostic_executions?select=' + selectFields + '&order=created_at.desc&limit=100';
          });
        }, []).then(function(outcome) {
          return sendOk(res, { checklist: buildChecklist(outcome.value), errors: { checklist: outcome.error } });
        });
      }

      if (action === 'journey' || action === 'journeys') {
        var traceId = String((req.query && req.query.conversation_trace_id) || '').trim();
        if (!traceId) return sendError(res, 'TRACE_ID_REQUIRED', 'conversation_trace_id é obrigatório.', 400);
        return safeExec('journeys', function() {
          return queryDiagnosticExecutions('journeys', function(selectFields) {
            return 'diagnostic_executions?conversation_trace_id=eq.' + encodeURIComponent(traceId) + '&select=' + selectFields + '&order=created_at.asc&limit=300';
          });
        }, []).then(function(outcome) {
          return sendOk(res, { journey: outcome.value, conversationTraceId: traceId, errors: { journeys: outcome.error } });
        });
      }


      if (action === 'exercise_catalog') {
        return query('exercises?select=id,media_type,media_url,gif_url,instructions,common_errors,breathing_tip,completeness_score,media_confidence_score,quality_flags,is_active&is_active=eq.true&limit=2000')
          .then(function(rows) {
            var summary = buildExerciseCatalogSummary(rows);
            console.info('[admin-diagnostics] exercise_catalog_admin_summary_loaded', summary);
            return sendOk(res, { summary: summary });
          })
          .catch(function(err) {
            return sendError(res, 'EXERCISE_CATALOG_ERROR', normalizeError(err), 500);
          });
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
          queryDiagnosticExecutions('health_post_recent', function(selectFields) { return 'diagnostic_executions?select=' + selectFields + '&order=created_at.desc&limit=200'; }),
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
