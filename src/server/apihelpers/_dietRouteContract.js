var responseUtil = require('./_response');
var planRules = require('../../lib/plans/planRules');
var domain = require('../../types/domain');

function normalizeDietAction(action) {
  var raw = String(action || 'GENERATE_DIET').trim().toUpperCase();
  if (raw === 'GENERATE_DIET' || raw === 'ADJUST_DIET' || raw === 'ANALYZE_DIET') return raw;
  return null;
}

function mapPlanForGate(dbPlan) {
  var canonical = planRules.toCanonicalPlan(dbPlan || domain.PLAN.FREE);
  if (canonical === domain.PLAN.TRIAL_ULTRA_7_DAYS) return domain.PLAN.ULTRA;
  if (canonical === domain.PLAN.PRO || canonical === domain.PLAN.ULTRA) return canonical;
  return domain.PLAN.FREE;
}

function buildDietRouteEnvelope(result, options) {
  var input = result && typeof result === 'object' ? result : {};
  var opts = options && typeof options === 'object' ? options : {};
  var plan = input.payload && input.payload.plan && typeof input.payload.plan === 'object'
    ? input.payload.plan
    : {};
  var serviceMeta = {
    action: input.action || 'GENERATE_DIET',
    domain: input.domain || 'diet',
    errorCode: input.errorCode || null,
    validation: input.payload && input.payload.validation ? input.payload.validation : null,
    gatedPlan: opts.plan || null,
  };

  return responseUtil.createApiEnvelope({
    success: true,
    type: 'diet_result',
    state: plan.failSafe ? 'validation_required' : 'success',
    message: String(input.message || 'Dieta processada com sucesso.'),
    requestId: opts.requestId || null,
    userId: opts.userId || null,
    error: null,
    data: {
      content: [{
        type: 'diet_result',
        data: plan,
        text: String(input.message || 'Dieta processada com sucesso.')
      }],
      service: serviceMeta,
    },
    meta: {
      flow: 'kronia_diet_route',
      failSafe: !!plan.failSafe,
      plan: opts.plan || null,
    }
  });
}

function buildDietRouteErrorEnvelope(input, options) {
  var err = input && typeof input === 'object' ? input : {};
  var opts = options && typeof options === 'object' ? options : {};
  return responseUtil.createApiEnvelope({
    success: false,
    type: 'error',
    state: err.state || 'invalid_request',
    message: String(err.message || 'Não consegui processar a dieta agora.'),
    requestId: opts.requestId || null,
    userId: opts.userId || null,
    error: err.error || 'DIET_ROUTE_ERROR',
    data: { content: [] },
    meta: {
      flow: 'kronia_diet_route',
      plan: opts.plan || null,
    }
  });
}

module.exports = {
  normalizeDietAction: normalizeDietAction,
  mapPlanForGate: mapPlanForGate,
  buildDietRouteEnvelope: buildDietRouteEnvelope,
  buildDietRouteErrorEnvelope: buildDietRouteErrorEnvelope,
};
