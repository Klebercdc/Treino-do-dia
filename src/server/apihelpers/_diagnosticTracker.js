var crypto = require('crypto');
var plans = require('./_plans');
var constants = require('./_diagnosticConstants');

var TRACE_LEVEL = constants.normalizeTraceLevel(process.env.ADMIN_DIAGNOSTIC_TRACE_LEVEL, constants.TRACE_LEVELS.STANDARD);
var WRITE_TIMEOUT_MS = Math.max(150, Number(process.env.ADMIN_DIAGNOSTIC_WRITE_TIMEOUT_MS || 1200));
var MAX_TEXT_LENGTH = Math.max(120, Number(process.env.ADMIN_DIAGNOSTIC_TEXT_LIMIT || 500));
var SENSITIVE_KEY_DENYLIST = ['token', 'secret', 'password', 'apikey', 'authorization', 'service_role', 'key'];
var METADATA_ALLOWLIST = ['traceLevel', 'hasConversationState', 'scenario', 'dryRun', 'llmCalled', 'llmSkipped', 'promptSizeEstimate', 'responseSizeEstimate', 'reasonForLlmSkip', 'healthCheck', 'forceErrorType'];

function isDiagnosticsEnabled() {
  var raw = String(process.env.ENABLE_ADMIN_DIAGNOSTICS || 'true').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function nowMs() {
  return Date.now();
}

function summarizeText(value, maxLen) {
  try {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    var limit = Math.max(40, Number(maxLen || MAX_TEXT_LENGTH));
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1) + '…';
  } catch (err) {
    return '[summary_unavailable]';
  }
}

function hashSignature(value) {
  var str = String(value == null ? '' : value);
  if (!str) return null;
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

function maskSensitiveData(input) {
  if (input == null) return input;
  if (typeof input === 'string') {
    var masked = input
      .replace(/(sk-[a-zA-Z0-9_-]{10,})/g, '[redacted:key]')
      .replace(/(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+)/g, '[redacted:jwt]')
      .replace(/(Bearer\s+[A-Za-z0-9._\-]+)/gi, 'Bearer [redacted]');
    return summarizeText(masked, 300);
  }
  if (Array.isArray(input)) return input.slice(0, 12).map(maskSensitiveData);
  if (typeof input === 'object') {
    var out = {};
    Object.keys(input).forEach(function(key) {
      var low = String(key || '').toLowerCase();
      var isSensitive = SENSITIVE_KEY_DENYLIST.some(function(token) { return low.indexOf(token) >= 0; });
      out[key] = isSensitive ? '[redacted]' : maskSensitiveData(input[key]);
    });
    return out;
  }
  return input;
}

function sanitizeMetadata(meta) {
  var input = meta && typeof meta === 'object' ? meta : {};
  var out = {};
  Object.keys(input).forEach(function(key) {
    if (TRACE_LEVEL === constants.TRACE_LEVELS.VERBOSE || METADATA_ALLOWLIST.indexOf(key) >= 0) {
      out[key] = maskSensitiveData(input[key]);
    }
  });
  return out;
}

function resolveTraceLevel(input) {
  var desired = constants.normalizeTraceLevel((input && input.traceLevel) || TRACE_LEVEL, TRACE_LEVEL);
  if (input && input.isAdminMode) return constants.TRACE_LEVELS.VERBOSE;
  if (input && (input.forceVerbose || input.suspectedIssue)) return constants.TRACE_LEVELS.VERBOSE;
  return desired;
}

function shouldKeepStepMetadata() {
  return TRACE_LEVEL !== constants.TRACE_LEVELS.MINIMAL;
}

function toDuration(start) {
  if (!start) return null;
  return Math.max(0, nowMs() - start);
}

function withTimeout(promiseLike, timeoutMs) {
  return new Promise(function(resolve) {
    var done = false;
    var timer = setTimeout(function() {
      if (done) return;
      done = true;
      resolve({ timeout: true });
    }, timeoutMs);

    Promise.resolve(promiseLike).then(function(value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ value: value });
    }).catch(function(error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ error: String(error && error.message ? error.message : error) });
    });
  });
}

function safeSupabaseRequest(method, path, body, timeoutMs) {
  return withTimeout(new Promise(function(resolve, reject) {
    plans.supabaseRequest(method, path, body, function(err, rows) {
      if (err) return reject(err);
      return resolve(rows);
    });
  }), timeoutMs || WRITE_TIMEOUT_MS);
}

function parseMissingColumnName(errorText) {
  var text = String(errorText || '');
  var match = text.match(/column\s+"?([a-z_]+)"?\s+of relation\s+"diagnostic_executions"\s+does not exist/i)
    || text.match(/column\s+diagnostic_executions\.([a-z_]+)\s+does not exist/i);
  return match ? match[1] : null;
}

function buildPayloadWithoutMissingColumn(payload, errorText) {
  var missing = parseMissingColumnName(errorText);
  if (!missing || !Object.prototype.hasOwnProperty.call(payload, missing)) return null;
  var clone = Object.assign({}, payload);
  delete clone[missing];
  return clone;
}

function buildExecutionSummary(execution, steps) {
  var failedSteps = steps.filter(function(s) { return s.success === false; }).length;
  return {
    executionId: execution.execution_id,
    status: execution.final_status,
    success: execution.success,
    durationMs: execution.duration_ms,
    intent: execution.intent_detected,
    pipeline: execution.pipeline_selected,
    fallbackUsed: execution.fallback_used,
    stepCount: steps.length,
    failedSteps: failedSteps
  };
}

function DiagnosticTracker(input) {
  input = input || {};
  this.traceLevel = resolveTraceLevel(input);
  this.enabled = isDiagnosticsEnabled();
  var conversationTraceId = input.conversationTraceId || input.sessionId || input.userId || crypto.randomUUID();
  this.execution = {
    execution_id: input.executionId || crypto.randomUUID(),
    correlation_id: input.correlationId || crypto.randomUUID(),
    conversation_trace_id: conversationTraceId,
    parent_execution_id: input.parentExecutionId || null,
    user_id: input.userId || null,
    session_id: input.sessionId || null,
    is_admin_mode: !!input.isAdminMode,
    source: input.source || 'chat',
    input_type: input.inputType || null,
    raw_input_summary: summarizeText(maskSensitiveData(input.rawInput || ''), 600),
    normalized_input_summary: summarizeText(maskSensitiveData(input.normalizedInput || ''), 600),
    intent_detected: input.intentDetected || null,
    intent_confidence: input.intentConfidence == null ? null : Number(input.intentConfidence),
    pipeline_selected: input.pipelineSelected || null,
    decision_reason: summarizeText(maskSensitiveData(input.decisionReason || ''), 600),
    fallback_used: false,
    severity: constants.SEVERITY.INFO,
    pipeline_version: constants.VERSION_INFO.pipelineVersion,
    prompt_version: constants.VERSION_INFO.promptVersion,
    rules_version: constants.VERSION_INFO.rulesVersion,
    graph_mapping_version: constants.VERSION_INFO.graphMappingVersion,
    diagnostic_schema_version: constants.VERSION_INFO.diagnosticSchemaVersion,
    diagnostic_quality_score: null,
    diagnostic_quality_band: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    duration_ms: null,
    success: null,
    final_status: 'running',
    error_code: null,
    error_message: null,
    response_summary: null,
    graph_path: [],
    metadata: sanitizeMetadata(input.metadata || {})
  };
  this._steps = [];
  this._open = {};
  this._startMs = nowMs();
}

DiagnosticTracker.prototype.startExecution = function(extra) {
  if (!this.enabled) return this.execution.execution_id;
  if (extra && typeof extra === 'object') this.execution.metadata = Object.assign({}, this.execution.metadata, sanitizeMetadata(extra));
  return this.execution.execution_id;
};

DiagnosticTracker.prototype.addStep = function(stepInput) {
  if (!this.enabled) return null;
  var safeInput = stepInput || {};
  var order = this._steps.length + 1;
  var row = {
    execution_id: this.execution.execution_id,
    step_order: order,
    layer: safeInput.layer || 'application',
    node_key: safeInput.nodeKey || null,
    step_name: safeInput.stepName || ('step_' + order),
    status: safeInput.status || 'running',
    input_summary: summarizeText(maskSensitiveData(safeInput.inputSummary || ''), 500),
    output_summary: summarizeText(maskSensitiveData(safeInput.outputSummary || ''), 500),
    decision_reason: summarizeText(maskSensitiveData(safeInput.decisionReason || ''), 400),
    duration_ms: safeInput.durationMs == null ? null : Number(safeInput.durationMs),
    success: safeInput.success == null ? null : !!safeInput.success,
    error_code: safeInput.errorCode || null,
    error_message: summarizeText(maskSensitiveData(safeInput.errorMessage || ''), 280),
    prompt_signature: safeInput.promptSignature || null,
    context_summary: summarizeText(maskSensitiveData(safeInput.contextSummary || ''), 400),
    dependency_summary: summarizeText(maskSensitiveData(safeInput.dependencySummary || ''), 400),
    severity: safeInput.severity || constants.SEVERITY.INFO,
    metadata: shouldKeepStepMetadata() ? sanitizeMetadata(safeInput.metadata || {}) : {}
  };
  this._steps.push(row);
  return order;
};

DiagnosticTracker.prototype.startStep = function(stepName, info) {
  if (!this.enabled) return null;
  this._open[stepName] = { start: nowMs(), info: info || {} };
  return stepName;
};

DiagnosticTracker.prototype.finishStep = function(stepName, result) {
  if (!this.enabled) return;
  var open = this._open[stepName] || { start: nowMs(), info: {} };
  delete this._open[stepName];
  var merged = Object.assign({}, open.info || {}, result || {});
  this.addStep({
    layer: merged.layer,
    nodeKey: merged.nodeKey,
    stepName: stepName,
    status: merged.status || (merged.success === false ? 'error' : 'success'),
    inputSummary: merged.inputSummary,
    outputSummary: merged.outputSummary,
    decisionReason: merged.decisionReason,
    durationMs: merged.durationMs == null ? toDuration(open.start) : merged.durationMs,
    success: merged.success == null ? true : merged.success,
    errorCode: merged.errorCode,
    errorMessage: merged.errorMessage,
    promptSignature: merged.promptSignature,
    contextSummary: merged.contextSummary,
    dependencySummary: merged.dependencySummary,
    metadata: merged.metadata
  });
};

DiagnosticTracker.prototype.captureDecision = function(decision) {
  if (!this.enabled) return;
  var input = decision || {};
  if (input.intentDetected) this.execution.intent_detected = input.intentDetected;
  if (input.intentConfidence != null) this.execution.intent_confidence = Number(input.intentConfidence);
  if (input.pipelineSelected) this.execution.pipeline_selected = input.pipelineSelected;
  if (input.reason) this.execution.decision_reason = summarizeText(maskSensitiveData(input.reason), 600);
  if (input.fallbackUsed != null) this.execution.fallback_used = !!input.fallbackUsed;
  if (input.graphNode) this.execution.graph_path.push(String(input.graphNode));

  this.addStep({
    layer: 'decision',
    nodeKey: input.graphNode || 'decision_router',
    stepName: constants.STEP_NAMES.DECISION_ROUTED,
    status: 'success',
    success: true,
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary,
    decisionReason: input.reason,
    contextSummary: input.contextSummary,
    metadata: input.metadata,
    severity: input.severity || constants.SEVERITY.INFO
  });
};

DiagnosticTracker.prototype.captureMetric = function(metric) {
  if (!this.enabled || !metric) return;
  var key = metric.key || 'metric';
  this.execution.metadata = this.execution.metadata || {};
  this.execution.metadata.metrics = this.execution.metadata.metrics || {};
  this.execution.metadata.metrics[key] = {
    value: maskSensitiveData(metric.value),
    unit: metric.unit || null,
    at: new Date().toISOString()
  };
};

DiagnosticTracker.prototype.markSuccess = function(info) {
  if (!this.enabled) return;
  var input = info || {};
  this.execution.success = true;
  this.execution.final_status = input.finalStatus || 'success';
  this.execution.severity = input.severity || constants.SEVERITY.INFO;
  this.execution.response_summary = summarizeText(maskSensitiveData(input.responseSummary || ''), 900);
};

DiagnosticTracker.prototype.markFailure = function(info) {
  if (!this.enabled) return;
  var input = info || {};
  this.execution.success = false;
  this.execution.final_status = input.finalStatus || 'failed';
  this.execution.error_code = input.errorCode || 'UNEXPECTED_ERROR';
  this.execution.error_message = summarizeText(maskSensitiveData(input.errorMessage || 'Falha não classificada.'), 800);
  this.execution.severity = input.severity || constants.SEVERITY.ERROR;
};

DiagnosticTracker.prototype.captureQualityFlags = function(payload) {
  if (!this.enabled) return;
  var p = payload || {};
  var flags = [];
  if (p.intent === 'greeting' && Number(p.responseSizeEstimate || 0) > 500) flags.push('greeting_response_too_long');
  if (p.intent === 'supplement' && p.pipelineSelected === 'open_workout_flow') flags.push('supplement_misrouted_to_workout');
  if (p.lowConfidence && p.llmCalled && !p.fallbackUsed) flags.push('low_confidence_assertive_response');
  if (p.localReplyEligible && p.llmCalled) flags.push('llm_overuse_candidate');
  if (p.fallbackRepeated) flags.push('fallback_repetition');
  if (p.promptSizeEstimate > 2200) flags.push('prompt_bloat_indicator');

  var score = 100;
  score -= flags.length * 12;
  if (p.errorCount) score -= Math.min(30, p.errorCount * 8);
  if (p.durationMs > 3500) score -= 10;
  if (p.fallbackUsed) score -= 6;
  if (p.lowConfidence) score -= 6;
  score = Math.max(0, Math.min(100, score));

  this.execution.metadata = this.execution.metadata || {};
  this.execution.metadata.quality_flags = flags;
  this.execution.metadata.estimated_cost_band = p.estimatedCostBand || (p.llmCalled ? 'medium' : 'low');
  this.execution.metadata.unnecessary_llm_risk = flags.indexOf('llm_overuse_candidate') >= 0;
  this.execution.metadata.low_value_llm_call = flags.indexOf('llm_overuse_candidate') >= 0;
  this.execution.metadata.prompt_bloat_indicator = flags.indexOf('prompt_bloat_indicator') >= 0;
  this.execution.diagnostic_quality_score = score;
  this.execution.diagnostic_quality_band = score >= 85 ? 'excellent' : (score >= 65 ? 'good' : (score >= 40 ? 'warning' : 'critical'));
  if (score < 40 && this.execution.severity === constants.SEVERITY.INFO) this.execution.severity = constants.SEVERITY.WARNING;
};

DiagnosticTracker.prototype.finishExecution = function(callback) {
  var self = this;
  if (!self.enabled) {
    if (callback) callback(null, { disabled: true, execution_id: self.execution.execution_id });
    return;
  }

  self.execution.finished_at = new Date().toISOString();
  self.execution.duration_ms = toDuration(self._startMs);
  if (self.execution.success == null) {
    self.execution.success = true;
    self.execution.final_status = 'success';
  }

  var payload = Object.assign({}, self.execution, {
    graph_path: Array.from(new Set(self.execution.graph_path)).join(' > '),
    metadata: sanitizeMetadata(self.execution.metadata || {})
  });

  safeSupabaseRequest('POST', 'diagnostic_executions', payload).then(function(execResult) {
    if (execResult && execResult.error) {
      var downgradedPayload = buildPayloadWithoutMissingColumn(payload, execResult.error);
      if (downgradedPayload) {
        return safeSupabaseRequest('POST', 'diagnostic_executions', downgradedPayload).then(function(retryExecResult) {
          return persistSteps(retryExecResult, downgradedPayload);
        });
      }
    }
    return persistSteps(execResult, payload);
  }).catch(function(unexpectedErr) {
    if (callback) callback(String(unexpectedErr && unexpectedErr.message ? unexpectedErr.message : unexpectedErr), { execution: null, summary: buildExecutionSummary(payload, self._steps) });
  });

  function persistSteps(execResult, executionRow) {
    var insertedRows = execResult && execResult.value;
    if (!self._steps.length) {
      if (callback) callback(execResult && execResult.error ? execResult.error : null, { execution: insertedRows && insertedRows[0], timeout: !!(execResult && execResult.timeout), summary: buildExecutionSummary(executionRow, self._steps) });
      return Promise.resolve();
    }

    return safeSupabaseRequest('POST', 'diagnostic_steps', self._steps).then(function(stepResult) {
      var err = null;
      if (execResult && execResult.error) err = execResult.error;
      if (!err && stepResult && stepResult.error) err = stepResult.error;
      if (callback) callback(err, { execution: insertedRows && insertedRows[0], timeout: !!((execResult && execResult.timeout) || (stepResult && stepResult.timeout)), summary: buildExecutionSummary(executionRow, self._steps) });
    });
  }
};

DiagnosticTracker.prototype.exportExecutionReport = function(format) {
  var steps = this._steps.slice().sort(function(a, b) { return Number(a.step_order || 0) - Number(b.step_order || 0); });
  var report = {
    execution: this.execution,
    steps: steps,
    summary: buildExecutionSummary(this.execution, steps)
  };
  if (String(format || 'json').toLowerCase() === 'text') {
    return [
      'execution_id: ' + report.execution.execution_id,
      'status: ' + report.execution.final_status,
      'intent: ' + (report.execution.intent_detected || 'unknown'),
      'pipeline: ' + (report.execution.pipeline_selected || 'unknown'),
      'duration_ms: ' + (report.execution.duration_ms || 0),
      'decision_reason: ' + (report.execution.decision_reason || ''),
      'steps:',
      report.steps.map(function(step) {
        return '- #' + step.step_order + ' [' + (step.status || 'unknown') + '] ' + step.step_name + ' (' + (step.layer || '-') + '/' + (step.node_key || '-') + ') ' + (step.duration_ms || 0) + 'ms';
      }).join('\n')
    ].join('\n');
  }
  return report;
};

module.exports = {
  DiagnosticTracker: DiagnosticTracker,
  maskSensitiveData: maskSensitiveData,
  buildExecutionSummary: buildExecutionSummary,
  isDiagnosticsEnabled: isDiagnosticsEnabled,
  hashSignature: hashSignature,
  sanitizeMetadata: sanitizeMetadata
};
