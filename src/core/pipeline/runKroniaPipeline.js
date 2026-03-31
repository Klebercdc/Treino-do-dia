const { normalizeMessage, classifyIntent } = require('../intent/intentClassifier');
const { decideAction } = require('../decision/decisionEngine');
const { planGate } = require('../plans/planGate');
const { executeDomainAction } = require('../execution/executorRouter');
const { estimateCost } = require('../usage/usageMeter');
const { buildDiagnosticLog } = require('../observability/diagnostics');
const historyService = require('../../services/history/historyService');

async function runKroniaPipeline({ userMessage, userPlan, payload }) {
  const startedAt = Date.now();
  const normalizedMessage = normalizeMessage(userMessage);
  const classification = classifyIntent(normalizedMessage);
  const decision = decideAction(classification, payload?.context || {});

  const gate = decision.requires_plan_gate ? planGate({ plan: userPlan, action: decision.action }) : { allowed: true, plan: userPlan || 'FREE', reason: null };

  const executionResult = gate.allowed
    ? await executeDomainAction({ action: decision.action, domain: decision.domain, payload })
    : { action: 'BLOCKED_BY_PLAN', domain: decision.domain, payload: { reason: gate.reason } };

  const cost = estimateCost({ action: decision.action, response_mode: decision.response_mode });

  const response = {
    success: true,
    intent: classification.intent,
    action: executionResult.action,
    domain: decision.domain,
    message: gate.allowed ? 'Ação executada.' : 'Feature indisponível no plano atual.',
    data: executionResult,
    meta: {
      plan: gate.plan,
      response_mode: decision.response_mode,
      latency_ms: Date.now() - startedAt,
      estimated_cost_usd: cost.estimated_cost_usd,
    },
    error: null,
  };

  await historyService.persistResult({ classification, decision, gate, response });

  const diagnostics = buildDiagnosticLog({
    ...classification,
    action: response.action,
    response_mode: response.meta.response_mode,
    user_plan: response.meta.plan,
    latency_ms: response.meta.latency_ms,
    estimated_cost_usd: response.meta.estimated_cost_usd,
  });

  return { response, diagnostics };
}

module.exports = { runKroniaPipeline };
