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
    'clinicalData',
    'clinicalFlow',
    'aderencia', 'adherenceContext',
    'nutritionFlowSelections',
    'trainingSnapshot',
    'nutritionGoals', 'goals',
    'supabaseSnapshot',
    'foodCatalogContext',
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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickNumber() {
  for (var i = 0; i < arguments.length; i += 1) {
    var value = arguments[i];
    if (value === undefined || value === null || value === '') continue;
    var parsed = Number(String(value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parsePortionGrams(item) {
  var candidates = [item.grams, item.gramas, item.peso_g, item.weight_g, item.qtde, item.porcao, item.portionLabel, item.qty, item.quantidade];
  for (var i = 0; i < candidates.length; i += 1) {
    var value = candidates[i];
    if (value == null || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    var text = String(value).toLowerCase().replace(',', '.');
    var kg = text.match(/(\d+(?:\.\d+)?)\s*kg\b/);
    if (kg) return Number(kg[1]) * 1000;
    var g = text.match(/(\d+(?:\.\d+)?)\s*g\b/);
    if (g) return Number(g[1]);
  }
  return null;
}

function foodName(item) {
  return String((item && (item.nome || item.name || item.alimento || item.food || item.item)) || '').trim();
}

function foodCatalogItems(payload) {
  var source = payload && payload.foodCatalogContext && Array.isArray(payload.foodCatalogContext.items)
    ? payload.foodCatalogContext.items
    : payload && payload.context && payload.context.foodCatalogContext && Array.isArray(payload.context.foodCatalogContext.items)
      ? payload.context.foodCatalogContext.items
      : [];
  return source.filter(function(item) { return item && item.name && item.per100g; });
}

function findFoodCatalogMatch(name, catalog) {
  var normalized = normalizeText(name);
  if (!normalized || !Array.isArray(catalog) || !catalog.length) return null;
  var tokens = normalized.split(' ').filter(function(t) { return t.length > 2; });
  var best = null;
  var bestScore = 0;
  catalog.forEach(function(item) {
    var food = normalizeText(item.name);
    if (!food) return;
    var score = 0;
    if (food === normalized) score += 100;
    if (food.indexOf(normalized) >= 0 || normalized.indexOf(food) >= 0) score += 50;
    tokens.forEach(function(token) { if (food.indexOf(token) >= 0) score += 8; });
    if (score > bestScore) { bestScore = score; best = item; }
  });
  return bestScore >= 16 ? best : null;
}

function applyCatalogMacro(item, match) {
  var grams = parsePortionGrams(item) || 100;
  var per = match && match.per100g ? match.per100g : {};
  var ratio = grams / 100;
  var kcal = pickNumber(per.kcal) != null ? Math.round(pickNumber(per.kcal) * ratio) : null;
  var protein = pickNumber(per.protein) != null ? Math.round(pickNumber(per.protein) * ratio * 10) / 10 : null;
  var carbs = pickNumber(per.carbs) != null ? Math.round(pickNumber(per.carbs) * ratio * 10) / 10 : null;
  var fat = pickNumber(per.fat) != null ? Math.round(pickNumber(per.fat) * ratio * 10) / 10 : null;
  var fiber = pickNumber(per.fiber) != null ? Math.round(pickNumber(per.fiber) * ratio * 10) / 10 : null;
  return Object.assign({}, item, {
    kcal: kcal != null ? kcal : item.kcal,
    calories: kcal != null ? kcal : item.calories,
    calorias: kcal != null ? kcal : item.calorias,
    prot: protein != null ? protein : item.prot,
    protein: protein != null ? protein : item.protein,
    protein_g: protein != null ? protein : item.protein_g,
    proteinas: protein != null ? protein : item.proteinas,
    carb: carbs != null ? carbs : item.carb,
    carbs: carbs != null ? carbs : item.carbs,
    carbs_g: carbs != null ? carbs : item.carbs_g,
    carboidratos: carbs != null ? carbs : item.carboidratos,
    gord: fat != null ? fat : item.gord,
    fat: fat != null ? fat : item.fat,
    fat_g: fat != null ? fat : item.fat_g,
    gorduras: fat != null ? fat : item.gorduras,
    fibra: fiber != null ? fiber : item.fibra,
    fiber_g: fiber != null ? fiber : item.fiber_g,
    food_catalog_id: match.id || item.food_catalog_id || null,
    taco_id: match.taco_id || item.taco_id || null,
    macroSource: match.source || 'food_catalog',
    macro_source: match.source || 'food_catalog',
    macroAudit: { source: match.source || 'food_catalog', grams: grams, catalogName: match.name },
  });
}

function applyFoodCatalogMacrosToResult(result, payload) {
  var catalog = foodCatalogItems(payload);
  if (!result || !result.payload || !result.payload.plan || !catalog.length) return result;
  var plan = result.payload.plan;
  var audit = { source: 'food_catalog', matchedItems: 0, unmatchedItems: [] };

  function enrichItem(item) {
    var name = foodName(item);
    var match = findFoodCatalogMatch(name, catalog);
    if (!match) {
      if (name) audit.unmatchedItems.push(name);
      return Object.assign({}, item, { macroSource: item.macroSource || 'llm_estimate', macro_source: item.macro_source || 'llm_estimate' });
    }
    audit.matchedItems += 1;
    return applyCatalogMacro(item, match);
  }

  var nextPlan = Object.assign({}, plan);
  if (Array.isArray(plan.refeicoes)) {
    nextPlan.refeicoes = plan.refeicoes.map(function(meal) {
      var alimentos = Array.isArray(meal.alimentos) ? meal.alimentos.map(enrichItem) : meal.alimentos;
      return Object.assign({}, meal, { alimentos: alimentos });
    });
  }
  if (plan.planoEstruturado && Array.isArray(plan.planoEstruturado.refeicoes)) {
    nextPlan.planoEstruturado = Object.assign({}, plan.planoEstruturado, {
      refeicoes: plan.planoEstruturado.refeicoes.map(function(meal) {
        return Object.assign({}, meal, { itens: Array.isArray(meal.itens) ? meal.itens.map(enrichItem) : meal.itens });
      }),
    });
  }
  audit.unmatchedItems = audit.unmatchedItems.filter(function(value, index, arr) { return arr.indexOf(value) === index; }).slice(0, 30);
  nextPlan.macroSource = audit.matchedItems ? 'food_catalog' : (nextPlan.macroSource || 'llm_estimate');
  nextPlan.foodCatalogMacroAudit = audit;
  result.payload.plan = nextPlan;
  return result;
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
  result = applyFoodCatalogMacrosToResult(result, payload);
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
  applyFoodCatalogMacrosToResult: applyFoodCatalogMacrosToResult,
  processDietRouteRequest: processDietRouteRequest
};