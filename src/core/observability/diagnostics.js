function buildDiagnosticLog(input) {
  const now = Date.now();
  return {
    timestamp: new Date(now).toISOString(),
    intent: input.intent,
    action: input.action,
    domain: input.domain,
    confidence: input.confidence,
    needs_clarification: input.needs_clarification,
    user_plan: input.user_plan,
    response_mode: input.response_mode,
    latency_ms: input.latency_ms,
    error_code: input.error_code || null,
    fallback_stage: input.fallback_stage || null,
    estimated_cost_usd: input.estimated_cost_usd || 0,
  };
}

module.exports = { buildDiagnosticLog };
