'use strict';

var clinical = require('./diet_context_clinical');

// ─── Constants ──────────────────────────────────────────────────────────────

var ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  ativo: 1.725,
  muito_ativo: 1.9
};

var OBJECTIVE_CONFIG = {
  emagrecimento: { calorieMultiplier: 0.85, proteinPerKg: 2.2, fatPerKg: 0.8 },
  manutencao:    { calorieMultiplier: 1.0,  proteinPerKg: 1.8, fatPerKg: 0.9 },
  hipertrofia:   { calorieMultiplier: 1.1,  proteinPerKg: 2.0, fatPerKg: 0.9 },
  recomposicao:  { calorieMultiplier: 0.95, proteinPerKg: 2.2, fatPerKg: 0.85 },
  forca:         { calorieMultiplier: 1.05, proteinPerKg: 2.0, fatPerKg: 0.95 }
};

// ─── Normalizers ────────────────────────────────────────────────────────────

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

function normalizeFreeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeObjective(input) {
  var raw = String(input || '').toLowerCase();
  if (/emagrec|cut|perder/.test(raw)) return 'emagrecimento';
  if (/hipertrof|bulking|massa|ganhar/.test(raw)) return 'hipertrofia';
  if (/recompos/.test(raw)) return 'recomposicao';
  if (/forca|strength/.test(raw)) return 'forca';
  return 'manutencao';
}

function normalizeActivity(input, rotina, frequencia) {
  var raw = String(input || rotina || '').toLowerCase();
  var freq = String(frequencia || '').toLowerCase();
  var daysMatch = freq.match(/(\d+)/);
  var days = daysMatch ? parseInt(daysMatch[1], 10) : NaN;
  if (!isNaN(days)) {
    if (days <= 1) return 'leve';
    if (days <= 3) return 'moderado';
    if (days <= 5) return 'ativo';
    return 'muito_ativo';
  }
  if (/sedent/.test(raw)) return 'sedentario';
  if (/leve|caminhad/.test(raw)) return 'leve';
  if (/muito|intens|duas vezes|atleta/.test(raw)) return 'muito_ativo';
  if (/ativo|moder/.test(raw)) return /ativo/.test(raw) ? 'ativo' : 'moderado';
  return 'moderado';
}

function normalizeSex(input) {
  var raw = String(input || '').trim().toLowerCase();
  if (!raw) return null;
  if (/^(f|fem|feminino|female|mulher|woman)$/.test(raw)) return 'feminino';
  if (/^(m|masc|masculino|male|homem|man)$/.test(raw)) return 'masculino';
  return null;
}

function normalizeStringArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  }
  return String(input).split(',').map(function(item) { return item.trim(); }).filter(Boolean);
}

function normalizeObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function pickNestedObject() {
  for (var i = 0; i < arguments.length; i += 1) {
    var value = arguments[i];
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) return value;
  }
  return null;
}

// ─── Unified nutrition context ───────────────────────────────────────────────

function buildUnifiedNutritionContext(input) {
  var safeInput = normalizeObject(input);
  var context = normalizeObject(safeInput.context);
  var profile = normalizeObject(safeInput.profile);
  var supabaseSnapshot = normalizeObject(safeInput.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot);
  var intakeSnapshot = normalizeObject(safeInput.intakeSnapshot || context.intakeSnapshot);
  var training = normalizeObject(
    safeInput.contextoTreino ||
    safeInput.trainingContext ||
    safeInput.trainingSnapshot ||
    context.contextoTreino ||
    context.trainingContext ||
    context.trainingSnapshot ||
    intakeSnapshot.treino
  );
  var health = normalizeObject(safeInput.saude || safeInput.healthContext || context.saude || context.healthContext);
  var adherence = normalizeObject(safeInput.aderencia || safeInput.adherenceContext || context.adherenceContext || intakeSnapshot.aderencia);
  var flowSelections = normalizeObject(safeInput.nutritionFlowSelections || context.nutritionFlowSelections);
  var goals = pickNestedObject(safeInput.nutritionGoals, safeInput.goals, profile.nutritionGoals, context.nutritionGoals, supabaseSnapshot.nutritionGoals);
  var labs = pickNestedObject(
    safeInput.labContext,
    safeInput.labs,
    profile.labContext,
    context.labContext,
    health.labContext,
    supabaseSnapshot.latestLabReport
  );
  var fatigue = Number(
    adherence.fadiga != null ? adherence.fadiga :
    training.fadiga != null ? training.fadiga :
    training.fatigue != null ? training.fatigue :
    intakeSnapshot.treino && intakeSnapshot.treino.fadiga
  );

  return {
    source: context.source || safeInput.source || 'nutrition_service',
    objective: safeInput.objetivo || safeInput.objective || profile.objetivo || profile.objective || null,
    preferences: normalizeStringArray(safeInput.preferencias || safeInput.preferences || profile.preferencias || profile.preferences),
    restrictions: normalizeStringArray(safeInput.restricoes || safeInput.restrictions || profile.restricoes || profile.restrictions),
    dislikes: normalizeStringArray(safeInput.alimentosEvitar || safeInput.dislikes || profile.alimentosEvitar || profile.dislikes),
    training: training,
    health: health,
    labs: labs,
    goals: goals,
    adherence: adherence,
    recovery: {
      fatigue: Number.isFinite(fatigue) ? Math.max(0, Math.min(10, fatigue)) : null,
      strengthTrend: adherence.tendenciaForca || training.tendenciaForca || training.strengthTrend || null,
      priority: adherence.prioridadeMetabolica || training.prioridadeMetabolica || training.priority || null,
      sleep: health.sono || safeInput.sono || null,
      stress: health.estresse || safeInput.estresse || null
    },
    foodSelections: flowSelections,
    supabaseSnapshot: Object.keys(supabaseSnapshot).length ? supabaseSnapshot : null,
    intakeSnapshot: Object.keys(intakeSnapshot).length ? intakeSnapshot : null
  };
}

// ─── Profile builder ─────────────────────────────────────────────────────────

function buildNutritionProfile(input) {
  var unifiedContext = buildUnifiedNutritionContext(input || {});
  var dietaryPattern = String(input.padraoAlimentar || input.dietaryPattern || '').trim();
  var dislikes = normalizeStringArray(input.alimentosEvitar || input.dislikes);
  var training = unifiedContext.training;
  return {
    sexo: normalizeSex(input.sexo),
    idade: Number(input.idade),
    peso: Number(input.peso),
    altura: Number(input.altura),
    objetivo: normalizeObjective(input.objetivo),
    nivelAtividade: normalizeActivity(input.nivelAtividade || input.nivel_atividade, input.rotina, training.frequencia || training.frequency),
    restricoesAlimentares: normalizeStringArray(input.restricoesAlimentares || input.restricoes).concat(dietaryPattern ? [dietaryPattern] : []),
    preferencias: normalizeStringArray(input.preferencias),
    alimentosEvitar: dislikes,
    refeicoesPorDia: Math.min(6, Math.max(3, Number(input.refeicoesPorDia || input.refeicoes_por_dia || 5))),
    usoSuplementos: normalizeStringArray(input.usoSuplementos || input.suplementos),
    observacoes: String(input.observacoes || '').trim(),
    padraoAlimentar: dietaryPattern || null,
    bodyFatPercent: input.gorduraCorporal || input.bodyFatPercent || null,
    biotipo: String(input.biotipo || '').trim() || null,
    contextoTreino: training,
    saude: unifiedContext.health,
    adherenceContext: unifiedContext.adherence,
    recoveryContext: unifiedContext.recovery,
    nutritionFlowSelections: unifiedContext.foodSelections,
    nutritionGoals: unifiedContext.goals || null,
    labContext: clinical.buildLabContext(unifiedContext.labs),
    contextoNutricional: unifiedContext
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateProfile(profile) {
  var errors = [];
  if (!profile.sexo) errors.push('sexo ausente');
  if (!profile.idade || profile.idade < 14 || profile.idade > 90) errors.push('idade inválida');
  if (!profile.peso || profile.peso < 35 || profile.peso > 300) errors.push('peso inválido');
  if (!profile.altura || profile.altura < 130 || profile.altura > 230) errors.push('altura inválida');
  return { ok: errors.length === 0, errors: errors };
}

// ─── Biometric calculations ──────────────────────────────────────────────────

function calculateBmr(profile) {
  var base = (10 * profile.peso) + (6.25 * profile.altura) - (5 * profile.idade);
  return round(base + (profile.sexo === 'masculino' ? 5 : -161), 2);
}

function calculateGet(bmr, profile) {
  return round(bmr * ACTIVITY_FACTORS[profile.nivelAtividade], 2);
}

function applyObjectiveToCalories(get, objective) {
  var config = OBJECTIVE_CONFIG[objective] || OBJECTIVE_CONFIG.manutencao;
  return round(get * config.calorieMultiplier);
}

function calculateMacroTargets(profile, targetCalories) {
  var config = OBJECTIVE_CONFIG[profile.objetivo] || OBJECTIVE_CONFIG.manutencao;
  var protein = round(profile.peso * config.proteinPerKg, 1);
  var fat = round(profile.peso * config.fatPerKg, 1);
  fat = Math.min(round(profile.peso * 1.0, 1), Math.max(round(profile.peso * 0.6, 1), fat));
  var carbs = round((targetCalories - (protein * 4) - (fat * 9)) / 4, 1);
  if (carbs < 70) carbs = 70;
  return { protein: protein, carbs: carbs, fat: fat };
}

// ─── Recovery strategy overlay ───────────────────────────────────────────────

function applyRecoveryStrategy(profile, targetCalories, macros) {
  var adjustedCalories = targetCalories;
  var adjustedMacros = { protein: macros.protein, carbs: macros.carbs, fat: macros.fat };
  var adjustments = [];
  var recovery = profile && profile.recoveryContext ? profile.recoveryContext : {};
  var fatigue = Number(recovery.fatigue);
  var priority = normalizeFreeText(recovery.priority || '');
  var strengthTrend = normalizeFreeText(recovery.strengthTrend || '');
  var needsRecovery =
    (Number.isFinite(fatigue) && fatigue >= 8) ||
    /recuper/.test(priority) ||
    /queda|caindo|pior/.test(strengthTrend);

  if (needsRecovery) {
    adjustedCalories = round(adjustedCalories + 80);
    adjustments.push(
      profile.objetivo === 'emagrecimento' || profile.objetivo === 'recomposicao'
        ? 'recovery_deficit_softened'
        : 'recovery_carbs_supported'
    );
    adjustedMacros.carbs = round((adjustedCalories - (adjustedMacros.protein * 4) - (adjustedMacros.fat * 9)) / 4, 1);
    if (adjustedMacros.carbs < 70) adjustedMacros.carbs = 70;
  }

  return { targetCalories: adjustedCalories, macros: adjustedMacros, adjustments: adjustments };
}

// ─── Strategy builder ────────────────────────────────────────────────────────

function limitedOrientationForFailSafe(profile, validation) {
  return {
    limited: true,
    reason: 'Dados insuficientes ou inconsistentes para plano completo.',
    inconsistencias: validation.errors,
    orientacao: 'Complete sexo, idade, peso e altura válidos para personalizar a dieta. Casos clínicos, uso de medicação ou sintomas gastrointestinais relevantes exigem nutricionista.',
    objetivoSolicitado: profile.objetivo
  };
}

function buildNutritionStrategy(profile) {
  var validation = validateProfile(profile);

  if (!validation.ok) {
    return {
      profile: profile,
      failSafe: true,
      limitedOrientation: limitedOrientationForFailSafe(profile, validation)
    };
  }

  var bmr = calculateBmr(profile);
  var get = calculateGet(bmr, profile);
  var requestedTarget = profile.nutritionGoals && Number(profile.nutritionGoals.calories_target);
  var rawTargetCalories = Number.isFinite(requestedTarget) && requestedTarget > 1200
    ? round(requestedTarget)
    : applyObjectiveToCalories(get, profile.objetivo);

  profile.getForClinicalSafety = round(get);
  var macros = calculateMacroTargets(profile, rawTargetCalories);
  var contextual = applyRecoveryStrategy(profile, rawTargetCalories, macros);
  var clinicalAdjusted = clinical.applyMedicalAdjustments(profile, rawTargetCalories, macros);
  if (!clinical.hasCriticalLabFlag(profile)) {
    clinicalAdjusted = contextual;
  }

  return {
    profile: profile,
    failSafe: false,
    formulas: {
      tmb: 'Mifflin-St Jeor',
      get: 'GET = TMB * fator de atividade',
      macros: 'Proteína 1.6-2.2 g/kg, gordura 0.6-1.0 g/kg e carboidratos pelas calorias restantes'
    },
    result: {
      tmb: bmr,
      get: get,
      targetCalories: clinicalAdjusted.targetCalories,
      macros: clinicalAdjusted.macros,
      activityFactor: ACTIVITY_FACTORS[profile.nivelAtividade],
      objective: profile.objetivo
    },
    strategy: {
      objective: profile.objetivo,
      activityLevel: profile.nivelAtividade,
      recovery: profile.recoveryContext || null,
      labsMode: (profile.labContext && profile.labContext.mode) || 'standard',
      adjustments: contextual.adjustments || []
    },
    unifiedContext: profile.contextoNutricional || null
  };
}

function calculateNutrition(profileInput) {
  var profile = buildNutritionProfile(profileInput || {});
  return buildNutritionStrategy(profile);
}

// ─── Public entry-points (kept from original thin wrapper) ──────────────────

/**
 * Computes calorie target, macros and training/clinical adjustments
 * from a normalized nutrition profile (output of buildNutritionProfile).
 */
function buildStrategy(profile) {
  return buildNutritionStrategy(profile);
}

/**
 * Builds a normalized nutrition profile from raw input, then computes strategy.
 * Convenience entry-point that covers the full context → strategy pipeline.
 */
function buildStrategyFromInput(profileInput) {
  return calculateNutrition(profileInput);
}

// ─── Advanced GET (wizard 6 etapas) ──────────────────────────────────────────
// NÃO substitui calculateGet(bmr, profile) que continua retornando number.

var _pcmEngine = null;
var _trainingEngine = null;
var _behaviorEngine = null;

function _lazyRequire() {
  if (!_pcmEngine) _pcmEngine = require('./pcm_engine');
  if (!_trainingEngine) _trainingEngine = require('./training_energy_engine');
  if (!_behaviorEngine) _behaviorEngine = require('./metabolic_behavior_engine');
}

function calculateGetAdvanced(profile) {
  _lazyRequire();
  var bodyComposition = _pcmEngine.buildBodyComposition(profile);
  var tmbResult = _pcmEngine.calculateTMB(profile, bodyComposition);
  var tmb = tmbResult.tmb;
  var tmb_method = tmbResult.tmb_method;
  var getResult = _trainingEngine.calculateActivityAdjustedGet(profile, tmb);
  var objective = profile.objective != null ? profile.objective : (profile.objetivo != null ? profile.objetivo : 'manutencao');
  var weight_kg = profile.weight_kg != null ? profile.weight_kg : (profile.peso != null ? profile.peso : 70);
  var macroBase = _behaviorEngine.getMacroBaseForObjective(objective, weight_kg, getResult.get);
  var adjusted = null;
  if (profile.metabolicBehavior) {
    var behavior = _behaviorEngine.normalizeMetabolicBehavior(profile.metabolicBehavior);
    var profileWithBehavior = Object.assign({}, profile, { metabolicBehavior: behavior });
    adjusted = _behaviorEngine.applyBehaviorAdjustments(profileWithBehavior, macroBase.targetCalories, macroBase);
  }
  return {
    get: getResult.get,
    tmb: tmb,
    tmb_method: tmb_method,
    getCalculationMode: getResult.getCalculationMode,
    trainingCaloriesDaily: getResult.training_daily_kcal,
    trainingCaloriesWeekly: getResult.training_weekly_kcal,
    neatCalories: getResult.neat_kcal,
    bodyComposition: bodyComposition,
    macros: adjusted ? adjusted.macros : macroBase,
    targetCalories: adjusted ? adjusted.adjusted_calories : macroBase.targetCalories,
    behaviorAdjustments: adjusted ? adjusted.flags : null,
    alerts: adjusted ? adjusted.alerts : [],
  };
}

module.exports = {
  ACTIVITY_FACTORS: ACTIVITY_FACTORS,
  OBJECTIVE_CONFIG: OBJECTIVE_CONFIG,
  buildNutritionProfile: buildNutritionProfile,
  buildUnifiedNutritionContext: buildUnifiedNutritionContext,
  buildNutritionStrategy: buildNutritionStrategy,
  calculateNutrition: calculateNutrition,
  validateProfile: validateProfile,
  buildStrategy: buildStrategy,
  buildStrategyFromInput: buildStrategyFromInput,
  calculateGetAdvanced: calculateGetAdvanced,
};
