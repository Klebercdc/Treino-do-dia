var dietService = require('../../services/diet/dietService');
var dietRouteContract = require('./_dietRouteContract');
var { planGate } = require('../../core/plans/planGate');

function buildPayload(body) {
  var safeBody = body && typeof body === 'object' ? body : {};
  var payload = safeBody.payload && typeof safeBody.payload === 'object'
    ? Object.assign({}, safeBody.payload)
    : {};

  var directKeys = [
    'objetivo', 'objective',
    'sexo', 'sex',
    'idade', 'age',
    'peso', 'pesoKg', 'weight', 'weightKg',
    'altura', 'alturaCm', 'height', 'heightCm',
    'gorduraCorporal', 'bodyFatPercent',
    'biotipo', 'somatotype',
    'rotina', 'routine',
    'nivelAtividade', 'activityLevel',
    'refeicoesPorDia', 'meals', 'mealCount',
    'padraoAlimentar', 'dietaryPattern',
    'restricoes', 'restrictions',
    'preferencias', 'preferences',
    'alimentosEvitar', 'dislikes',
    'suplementos', 'supplements',
    'observacoes', 'notes',
    'contextoTreino', 'trainingContext',
    'saude', 'healthContext',
    'nutritionGoals', 'goals',
    'supabaseSnapshot',
    'profile', 'context'
  ];

  directKeys.forEach(function(key) {
    if (safeBody[key] !== undefined && payload[key] === undefined) payload[key] = safeBody[key];
  });

  return payload;
}

async function processDietRouteRequest(input) {
  var request = input && typeof input === 'object' ? input : {};
  var body = request.body && typeof request.body === 'object' ? request.body : {};
  var requestId = request.requestId || null;
  var userId = request.userId || null;
  var effectivePlan = request.effectivePlan || 'FREE';

  var action = dietRouteContract.normalizeDietAction(body.action || 'GENERATE_DIET');
  if (!action) {
    return {
      status: 400,
      body: dietRouteContract.buildDietRouteErrorEnvelope({
        state: 'invalid_request',
        error: 'INVALID_DIET_ACTION',
        message: 'Ação de dieta inválida. Use GENERATE_DIET, ADJUST_DIET ou ANALYZE_DIET.'
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
      body: dietRouteContract.buildDietRouteErrorEnvelope({
        state: 'limit_reached_plan',
        error: 'LIMIT_REACHED_PLAN',
        message: 'Seu plano atual não permite este recurso de dieta. Faça upgrade para continuar.'
      }, {
        requestId: requestId,
        userId: userId,
        plan: gate.plan
      })
    };
  }

  var payload = buildPayload(body);
  var result = await dietService.execute(action, payload);
  return {
    status: 200,
    body: dietRouteContract.buildDietRouteEnvelope(result, {
      requestId: requestId,
      userId: userId,
      plan: gate.plan
    })
  };
}

module.exports = {
  buildPayload: buildPayload,
  processDietRouteRequest: processDietRouteRequest
};
