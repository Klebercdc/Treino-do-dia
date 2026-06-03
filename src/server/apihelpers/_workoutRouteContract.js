var responseUtil = require('./_response');
var planRules = require('../../lib/plans/planRules');
var domain = require('../../types/domain');

function normalizeWorkoutAction(action) {
  var raw = String(action || 'GENERATE_WORKOUT').trim().toUpperCase();
  if (raw === 'GENERATE_WORKOUT' || raw === 'ADJUST_WORKOUT' || raw === 'ANALYZE_WORKOUT' || raw === 'GET_KRONOS_CONTEXT') return raw;
  return null;
}

function mapPlanForGate(dbPlan) {
  var canonical = planRules.toCanonicalPlan(dbPlan || domain.PLAN.FREE);
  if (canonical === domain.PLAN.TRIAL_ULTRA_7_DAYS) return domain.PLAN.ULTRA;
  if (canonical === domain.PLAN.PRO || canonical === domain.PLAN.ULTRA) return canonical;
  return domain.PLAN.FREE;
}

function buildWorkoutRouteEnvelope(result, options) {
  var input = result && typeof result === 'object' ? result : {};
  var opts = options && typeof options === 'object' ? options : {};
  var plan = input.payload && input.payload.plan && typeof input.payload.plan === 'object'
    ? input.payload.plan
    : {};
  var isFailSafe = !!plan.failSafe;
  var responseType = isFailSafe ? 'workout_failsafe' : 'workout_primary';
  return responseUtil.createApiEnvelope({
    success: true,
    type: responseType,
    state: isFailSafe ? 'validation_required' : 'success',
    message: String(input.message || 'Treino processado com sucesso.'),
    requestId: opts.requestId || null,
    userId: opts.userId || null,
    error: null,
    data: {
      content: [{
        type: responseType,
        data: plan,
        text: String(input.message || 'Treino processado com sucesso.')
      }],
      service: {
        action: input.action || 'GENERATE_WORKOUT',
        domain: input.domain || 'workout',
        errorCode: input.errorCode || null,
        validation: input.payload && input.payload.validation ? input.payload.validation : null,
        gatedPlan: opts.plan || null,
        renderMode: responseType,
      },
    },
    meta: {
      flow: 'kronia_workout_route',
      failSafe: isFailSafe,
      renderMode: responseType,
      plan: opts.plan || null,
    }
  });
}

function buildWorkoutRouteErrorEnvelope(input, options) {
  var err = input && typeof input === 'object' ? input : {};
  var opts = options && typeof options === 'object' ? options : {};
  return responseUtil.createApiEnvelope({
    success: false,
    type: 'error',
    state: err.state || 'invalid_request',
    message: String(err.message || 'Não consegui processar o treino agora.'),
    requestId: opts.requestId || null,
    userId: opts.userId || null,
    error: err.error || 'WORKOUT_ROUTE_ERROR',
    data: { content: [] },
    meta: {
      flow: 'kronia_workout_route',
      plan: opts.plan || null,
    }
  });
}

module.exports = {
  normalizeWorkoutAction: normalizeWorkoutAction,
  mapPlanForGate: mapPlanForGate,
  buildWorkoutRouteEnvelope: buildWorkoutRouteEnvelope,
  buildWorkoutRouteErrorEnvelope: buildWorkoutRouteErrorEnvelope,
};
