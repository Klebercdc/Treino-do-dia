var dietService = require('../../services/diet/dietService');
var dietRouteContract = require('./_dietRouteContract');
var { planGate } = require('../../core/plans/planGate');
var trainingRecoveryHelper = require('./_trainingRecoveryContext');
var { createAdminSupabaseClient } = require('../../lib/supabase/admin');

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
    'clinicalData',
    'clinicalFlow',
    'aderencia', 'adherenceContext',
    'nutritionFlowSelections',
    'trainingSnapshot',
    'nutritionGoals', 'goals',
    'supabaseSnapshot',
    'profile', 'context',
    'kronosNutricaoContext'
  ];

  directKeys.forEach(function(key) {
    if (safeBody[key] !== undefined && payload[key] === undefined) payload[key] = safeBody[key];
  });

  return payload;
}

function mergeTrainingRecovery(payload, trainingRecovery) {
  if (!trainingRecovery) return payload;
  var safePayload = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
  var context = safePayload.context && typeof safePayload.context === 'object' ? Object.assign({}, safePayload.context) : {};
  var profile = safePayload.profile && typeof safePayload.profile === 'object' ? Object.assign({}, safePayload.profile) : {};
  var training = safePayload.contextoTreino && typeof safePayload.contextoTreino === 'object'
    ? Object.assign({}, safePayload.contextoTreino)
    : safePayload.trainingContext && typeof safePayload.trainingContext === 'object'
      ? Object.assign({}, safePayload.trainingContext)
      : {};
  var adherence = safePayload.aderencia && typeof safePayload.aderencia === 'object'
    ? Object.assign({}, safePayload.aderencia)
    : safePayload.adherenceContext && typeof safePayload.adherenceContext === 'object'
      ? Object.assign({}, safePayload.adherenceContext)
      : {};

  var trainingContext = Object.assign({}, training, {
    trainingRecovery: trainingRecovery,
    kroniaTrainingSignals: trainingRecovery,
    loadState: trainingRecovery.loadState,
    avgRpe: trainingRecovery.avgRpe,
    totalSetsLast7Days: trainingRecovery.totalSetsLast7Days,
    totalSetsLast14Days: trainingRecovery.totalSetsLast14Days,
    daysSinceLastWorkout: trainingRecovery.daysSinceLastWorkout,
    lastWorkoutDate: trainingRecovery.lastWorkoutDate,
    totalTrainingDays: trainingRecovery.totalTrainingDays,
    recoveryScore: trainingRecovery.recoveryScore,
    recoveryStatus: trainingRecovery.recoveryStatus,
    readiness: trainingRecovery.readiness,
    recentPRCount: trainingRecovery.recentPRCount,
    recentPRs: trainingRecovery.recentPRs,
    adaptations: trainingRecovery.adaptations,
    fadiga: trainingRecovery.fatigue && trainingRecovery.fatigue.score != null ? trainingRecovery.fatigue.score : training.fadiga,
    tendenciaForca: trainingRecovery.strengthTrend || training.tendenciaForca,
    prioridadeMetabolica: trainingRecovery.prioridadeMetabolica || training.prioridadeMetabolica,
    needsDeload: trainingRecovery.needsDeload,
    needsRecoveryFuel: trainingRecovery.needsRecoveryFuel,
    needsProteinDistribution: trainingRecovery.needsProteinDistribution,
    carbohydrateStrategy: trainingRecovery.carbohydrateStrategy,
    trainingNotes: trainingRecovery.trainingNotes,
  });
  var adherenceContext = Object.assign({}, adherence, {
    fadiga: trainingRecovery.fatigue && trainingRecovery.fatigue.score != null ? trainingRecovery.fatigue.score : adherence.fadiga,
    tendenciaForca: trainingRecovery.strengthTrend || adherence.tendenciaForca,
    prioridadeMetabolica: trainingRecovery.prioridadeMetabolica || adherence.prioridadeMetabolica,
    recoveryStatus: trainingRecovery.recoveryStatus,
    recoveryScore: trainingRecovery.recoveryScore,
  });

  return Object.assign({}, safePayload, {
    contextoTreino: trainingContext,
    trainingContext: trainingContext,
    trainingSnapshot: safePayload.trainingSnapshot || trainingRecovery,
    aderencia: adherenceContext,
    adherenceContext: adherenceContext,
    profile: Object.assign({}, profile, {
      contextoTreino: profile.contextoTreino || trainingContext,
      trainingSnapshot: profile.trainingSnapshot || trainingRecovery,
      adherenceContext: profile.adherenceContext || adherenceContext,
    }),
    context: Object.assign({}, context, {
      contextoTreino: context.contextoTreino || trainingContext,
      trainingContext: context.trainingContext || trainingContext,
      trainingSnapshot: context.trainingSnapshot || trainingRecovery,
      adherenceContext: context.adherenceContext || adherenceContext,
    }),
  });
}

async function tryLoadTrainingRecovery(userId) {
  if (!userId) return null;
  try {
    var admin = createAdminSupabaseClient();
    return await trainingRecoveryHelper.loadTrainingRecoveryContext(admin, userId);
  } catch (error) {
    console.warn('[diet-route-handler] training recovery unavailable', error && error.message);
    return null;
  }
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
  var trainingRecovery = await tryLoadTrainingRecovery(userId);
  payload = mergeTrainingRecovery(payload, trainingRecovery);
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
  mergeTrainingRecovery: mergeTrainingRecovery,
  processDietRouteRequest: processDietRouteRequest
};