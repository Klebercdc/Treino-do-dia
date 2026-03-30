var TRACE_LEVELS = Object.freeze({
  MINIMAL: 'minimal',
  STANDARD: 'standard',
  VERBOSE: 'verbose'
});

var SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
});

var VERSION_INFO = Object.freeze({
  pipelineVersion: process.env.KRONIA_PIPELINE_VERSION || '2026.03',
  promptVersion: process.env.KRONIA_PROMPT_VERSION || 'coach_prompt_v3',
  rulesVersion: process.env.KRONIA_RULES_VERSION || 'decision_engine_v2',
  graphMappingVersion: process.env.KRONIA_GRAPH_MAPPING_VERSION || 'transformers_map_v2',
  diagnosticSchemaVersion: process.env.KRONIA_DIAGNOSTIC_SCHEMA_VERSION || 'diag_schema_v3'
});

var STEP_NAMES = Object.freeze({
  INPUT_RECEIVED: 'input_received',
  INTENT_CLASSIFIED: 'intent_classified',
  DECISION_ROUTED: 'decision_routed',
  LOCAL_REPLY_SELECTED: 'local_reply_selected',
  TRAINING_PIPELINE_SELECTED: 'training_pipeline_selected',
  DIET_PIPELINE_SELECTED: 'diet_pipeline_selected',
  WORKOUT_GENERATION_REQUESTED: 'workout_generation_requested',
  LLM_RESPONSE_REQUESTED: 'llm_response_requested',
  LLM_FALLBACK_ACTIVATED: 'llm_fallback_activated',
  RESPONSE_PREPARED: 'response_prepared',
  DIAGNOSTIC_PERSISTED: 'diagnostic_persisted',
  DIAGNOSTIC_PERSIST_FAILED: 'diagnostic_persist_failed'
});

var NODE_KEY_MAP = Object.freeze({
  greeting: 'Usuario',
  request_workout: 'Treino',
  request_diet: 'Nutricao',
  supplement: 'Recomendacao',
  recovery: 'FadigaScore',
  workout_json: 'Treino',
  llm: 'Recomendacao',
  decision_router: 'Recomendacao',
  open_workout_flow: 'Treino',
  open_diet_flow: 'Nutricao',
  call_agent_tools: 'Recomendacao',
  local_reply: 'Usuario',
  error: 'Alerta'
});

function normalizeTraceLevel(raw, fallback) {
  var value = String(raw || fallback || TRACE_LEVELS.STANDARD).toLowerCase();
  if (value === TRACE_LEVELS.MINIMAL || value === TRACE_LEVELS.STANDARD || value === TRACE_LEVELS.VERBOSE) {
    return value;
  }
  return fallback || TRACE_LEVELS.STANDARD;
}

module.exports = {
  TRACE_LEVELS: TRACE_LEVELS,
  SEVERITY: SEVERITY,
  VERSION_INFO: VERSION_INFO,
  STEP_NAMES: STEP_NAMES,
  NODE_KEY_MAP: NODE_KEY_MAP,
  normalizeTraceLevel: normalizeTraceLevel
};
