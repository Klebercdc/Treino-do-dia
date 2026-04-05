var workoutService = require('../../services/workout/workoutService');
var workoutRouteContract = require('./_workoutRouteContract');
var { planGate } = require('../../core/plans/planGate');

function buildPayload(body) {
  var safeBody = body && typeof body === 'object' ? body : {};
  var payload = safeBody.payload && typeof safeBody.payload === 'object'
    ? Object.assign({}, safeBody.payload)
    : {};

  var directKeys = [
    'objetivo', 'objective',
    'nivel', 'level',
    'dias', 'days', 'days_per_week',
    'tempo', 'sessionLength',
    'equipamentos', 'equipment', 'environment',
    'limitacoes', 'limitations', 'restrictions',
    'scientificConstraints', 'scienceValidation',
    'profile', 'context'
  ];

  directKeys.forEach(function(key) {
    if (safeBody[key] !== undefined && payload[key] === undefined) payload[key] = safeBody[key];
  });

  return payload;
}

async function processWorkoutRouteRequest(input) {
  var request = input && typeof input === 'object' ? input : {};
  var body = request.body && typeof request.body === 'object' ? request.body : {};
  var requestId = request.requestId || null;
  var userId = request.userId || null;
  var effectivePlan = request.effectivePlan || 'FREE';

  var action = workoutRouteContract.normalizeWorkoutAction(body.action || 'GENERATE_WORKOUT');
  if (!action) {
    return {
      status: 400,
      body: workoutRouteContract.buildWorkoutRouteErrorEnvelope({
        state: 'invalid_request',
        error: 'INVALID_WORKOUT_ACTION',
        message: 'Ação de treino inválida. Use GENERATE_WORKOUT, ADJUST_WORKOUT ou ANALYZE_WORKOUT.'
      }, {
        requestId: requestId,
        userId: userId
      })
    };
  }

  var gate = planGate({ plan: effectivePlan, action: action });
  if (!gate.allowed) {
    return {
      status: 402,
      body: workoutRouteContract.buildWorkoutRouteErrorEnvelope({
        state: 'limit_reached_plan',
        error: 'LIMIT_REACHED_PLAN',
        message: 'Seu plano atual não permite este recurso de treino. Faça upgrade para continuar.'
      }, {
        requestId: requestId,
        userId: userId,
        plan: gate.plan
      })
    };
  }

  var payload = buildPayload(body);
  var result = await workoutService.execute(action, payload);
  return {
    status: 200,
    body: workoutRouteContract.buildWorkoutRouteEnvelope(result, {
      requestId: requestId,
      userId: userId,
      plan: gate.plan
    })
  };
}

module.exports = {
  buildPayload: buildPayload,
  processWorkoutRouteRequest: processWorkoutRouteRequest,
};
