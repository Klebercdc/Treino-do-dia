'use strict';

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

var ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  ativo: 1.725,
  muito_ativo: 1.9
};

var OBJECTIVE_CONFIG = {
  emagrecimento: { calorieMultiplier: 0.85, proteinPerKg: 2.2, fatPerKg: 0.8 },
  manutencao: { calorieMultiplier: 1.0, proteinPerKg: 1.8, fatPerKg: 0.9 },
  hipertrofia: { calorieMultiplier: 1.1, proteinPerKg: 2.0, fatPerKg: 0.9 },
  recomposicao: { calorieMultiplier: 0.95, proteinPerKg: 2.2, fatPerKg: 0.85 },
  forca: { calorieMultiplier: 1.05, proteinPerKg: 2.0, fatPerKg: 0.95 }
};

var MEAL_TEMPLATES = {
  3: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.28, carbShare: 0.24, fatShare: 0.28 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.37, carbShare: 0.36, fatShare: 0.36 },
    { tipo: 'jantar', nome: 'Jantar', horario: '20:00', proteinShare: 0.35, carbShare: 0.40, fatShare: 0.36 }
  ],
  4: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.25, carbShare: 0.22, fatShare: 0.28 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.3, carbShare: 0.28, fatShare: 0.27 },
    { tipo: 'lanche_pre_treino', nome: 'Pré-treino', horario: '16:30', proteinShare: 0.2, carbShare: 0.25, fatShare: 0.1 },
    { tipo: 'jantar_pos_treino', nome: 'Pós-treino / Jantar', horario: '20:30', proteinShare: 0.25, carbShare: 0.25, fatShare: 0.35 }
  ],
  5: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.22, carbShare: 0.17, fatShare: 0.24 },
    { tipo: 'lanche_manha', nome: 'Lanche da manhã', horario: '10:00', proteinShare: 0.13, carbShare: 0.12, fatShare: 0.15 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.25, carbShare: 0.22, fatShare: 0.22 },
    { tipo: 'lanche_pre_treino', nome: 'Pré-treino', horario: '16:30', proteinShare: 0.16, carbShare: 0.24, fatShare: 0.08 },
    { tipo: 'jantar_pos_treino', nome: 'Pós-treino / Jantar', horario: '20:30', proteinShare: 0.24, carbShare: 0.25, fatShare: 0.31 }
  ],
  6: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.2, carbShare: 0.15, fatShare: 0.22 },
    { tipo: 'lanche_manha', nome: 'Lanche da manhã', horario: '09:45', proteinShare: 0.13, carbShare: 0.11, fatShare: 0.13 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.22, carbShare: 0.18, fatShare: 0.22 },
    { tipo: 'lanche_pre_treino', nome: 'Pré-treino', horario: '15:45', proteinShare: 0.14, carbShare: 0.2, fatShare: 0.08 },
    { tipo: 'jantar_pos_treino', nome: 'Pós-treino / Jantar', horario: '19:30', proteinShare: 0.2, carbShare: 0.24, fatShare: 0.18 },
    { tipo: 'ceia', nome: 'Ceia', horario: '22:00', proteinShare: 0.11, carbShare: 0.12, fatShare: 0.17 }
  ]
};

var FOOD_LIBRARY = {
  breakfastProteins: [
    { code: 'ovo_3', name: 'Ovos mexidos', portionLabel: '3 un', grams: 150, calories: 210, protein: 18, carbs: 1, fat: 15, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'whey_30', name: 'Whey protein', portionLabel: '30 g', grams: 30, calories: 120, protein: 24, carbs: 3, fat: 2, fiber: 0, source: 'Rótulos médios de mercado (referência)' },
    { code: 'tofu_180', name: 'Tofu mexido', portionLabel: '180 g', grams: 180, calories: 173, protein: 18, carbs: 5, fat: 10, fiber: 2, source: 'USDA FoodData Central (adaptado)' },
    { code: 'iogurte_grego', name: 'Iogurte grego natural', portionLabel: '170 g', grams: 170, calories: 130, protein: 17, carbs: 6, fat: 4, fiber: 0, source: 'USDA FoodData Central (adaptado)' }
  ],
  fastProteins: [
    { code: 'whey_30_fast', name: 'Whey protein', portionLabel: '30 g', grams: 30, calories: 120, protein: 24, carbs: 3, fat: 2, fiber: 0, source: 'Rótulos médios de mercado (referência)' },
    { code: 'iogurte_170', name: 'Iogurte natural', portionLabel: '170 g', grams: 170, calories: 104, protein: 6, carbs: 8, fat: 5, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'tofu_150', name: 'Tofu firme', portionLabel: '150 g', grams: 150, calories: 144, protein: 15, carbs: 4, fat: 8, fiber: 2, source: 'USDA FoodData Central (adaptado)' }
  ],
  mealProteins: [
    { code: 'frango_120', name: 'Frango grelhado', portionLabel: '120 g', grams: 120, calories: 198, protein: 37, carbs: 0, fat: 4, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'patinho_120', name: 'Patinho grelhado', portionLabel: '120 g', grams: 120, calories: 225, protein: 34, carbs: 0, fat: 10, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'peixe_140', name: 'Tilápia grelhada', portionLabel: '140 g', grams: 140, calories: 180, protein: 33, carbs: 0, fat: 4, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'tofu_200', name: 'Tofu firme', portionLabel: '200 g', grams: 200, calories: 192, protein: 20, carbs: 5, fat: 11, fiber: 2.5, source: 'USDA FoodData Central (adaptado)' }
  ],
  breakfastCarbs: [
    { code: 'aveia_40', name: 'Aveia', portionLabel: '40 g', grams: 40, calories: 156, protein: 6.8, carbs: 26.5, fat: 3.4, fiber: 4.2, source: 'USDA FoodData Central (adaptado)' },
    { code: 'pao_2', name: 'Pão integral', portionLabel: '2 fatias', grams: 50, calories: 128, protein: 6, carbs: 24, fat: 2, fiber: 4, source: 'TACO/USDA (adaptado)' },
    { code: 'banana_1', name: 'Banana', portionLabel: '1 un média', grams: 90, calories: 80, protein: 1, carbs: 20.7, fat: 0.2, fiber: 2.1, source: 'TACO (adaptado)' }
  ],
  fastCarbs: [
    { code: 'banana_1_fast', name: 'Banana', portionLabel: '1 un média', grams: 90, calories: 80, protein: 1, carbs: 20.7, fat: 0.2, fiber: 2.1, source: 'TACO (adaptado)' },
    { code: 'fruta_vermelha_140', name: 'Frutas vermelhas', portionLabel: '140 g', grams: 140, calories: 70, protein: 1, carbs: 16, fat: 0.5, fiber: 4, source: 'USDA FoodData Central (adaptado)' },
    { code: 'granola_30', name: 'Granola', portionLabel: '30 g', grams: 30, calories: 128, protein: 3, carbs: 20, fat: 4, fiber: 2.5, source: 'USDA FoodData Central (adaptado)' }
  ],
  mealCarbs: [
    { code: 'arroz_120', name: 'Arroz cozido', portionLabel: '120 g', grams: 120, calories: 156, protein: 3, carbs: 34, fat: 0.4, fiber: 0.4, source: 'TACO/USDA (adaptado)' },
    { code: 'batata_doce_130', name: 'Batata-doce cozida', portionLabel: '130 g', grams: 130, calories: 112, protein: 2, carbs: 26, fat: 0.1, fiber: 3.3, source: 'TACO/USDA (adaptado)' },
    { code: 'macarrao_120', name: 'Macarrão cozido', portionLabel: '120 g', grams: 120, calories: 188, protein: 6, carbs: 37, fat: 1.2, fiber: 2, source: 'USDA FoodData Central (adaptado)' },
    { code: 'feijao_100', name: 'Feijão cozido', portionLabel: '100 g', grams: 100, calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5, source: 'TACO (adaptado)' }
  ],
  supportCarbs: [
    { code: 'banana_1_support', name: 'Banana', portionLabel: '1 un média', grams: 90, calories: 80, protein: 1, carbs: 20.7, fat: 0.2, fiber: 2.1, source: 'TACO (adaptado)' },
    { code: 'maca_1', name: 'Maçã', portionLabel: '1 un média', grams: 130, calories: 72, protein: 0.3, carbs: 19, fat: 0.2, fiber: 3, source: 'TACO (adaptado)' },
    { code: 'mel_20', name: 'Mel', portionLabel: '20 g', grams: 20, calories: 61, protein: 0, carbs: 17, fat: 0, fiber: 0, source: 'USDA FoodData Central (adaptado)' }
  ],
  breakfastFats: [
    { code: 'pasta_amendoim_20', name: 'Pasta de amendoim', portionLabel: '20 g', grams: 20, calories: 118, protein: 5, carbs: 4, fat: 10, fiber: 1.8, source: 'USDA FoodData Central (adaptado)' },
    { code: 'castanhas_20_breakfast', name: 'Castanhas', portionLabel: '20 g', grams: 20, calories: 120, protein: 3, carbs: 4, fat: 10, fiber: 2, source: 'USDA FoodData Central (adaptado)' }
  ],
  fats: [
    { code: 'azeite_10', name: 'Azeite de oliva', portionLabel: '10 g', grams: 10, calories: 88, protein: 0, carbs: 0, fat: 10, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'castanhas_20', name: 'Castanhas', portionLabel: '20 g', grams: 20, calories: 120, protein: 3, carbs: 4, fat: 10, fiber: 2, source: 'USDA FoodData Central (adaptado)' },
    { code: 'abacate_100', name: 'Abacate', portionLabel: '100 g', grams: 100, calories: 96, protein: 1.2, carbs: 6, fat: 8.4, fiber: 6.3, source: 'TACO (adaptado)' }
  ],
  veggies: [
    { code: 'brocolis_100', name: 'Brócolis cozido', portionLabel: '100 g', grams: 100, calories: 25, protein: 3, carbs: 4.4, fat: 0.5, fiber: 3.4, source: 'TACO (adaptado)' },
    { code: 'salada_1', name: 'Salada verde', portionLabel: '1 prato', grams: 100, calories: 20, protein: 1, carbs: 3, fat: 0.2, fiber: 2, source: 'TACO (adaptado)' },
    { code: 'legumes_100', name: 'Legumes cozidos', portionLabel: '100 g', grams: 100, calories: 35, protein: 1.5, carbs: 7, fat: 0.3, fiber: 2.8, source: 'TACO/USDA (adaptado)' }
  ]
};

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

function normalizeFreeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeClinicalFlags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  return [];
}

function resolveDietMode(labReport) {
  if (!labReport || !labReport.isValid || !labReport.parsed) return 'standard';
  return 'clinical';
}

function applyClinicalRules(labReport) {
  var parsed = labReport && labReport.parsed && typeof labReport.parsed === 'object' ? labReport.parsed : null;
  if (!parsed) return { mode: 'standard', clinicalFlags: [], criticalFlags: [] };

  var clinicalFlags = [];
  var criticalFlags = [];

  if (Number(parsed.glucose) > 100) clinicalFlags.push('pre_diabetes');
  if (Number(parsed.hba1c) > 5.7) clinicalFlags.push('glycemic_risk');
  if (Number(parsed.potassium) > 5) clinicalFlags.push('high_potassium');
  if (Number(parsed.ldl) > 130) clinicalFlags.push('high_ldl');

  if (Number(parsed.glucose) >= 126) criticalFlags.push('hyperglycemia_alert');
  if (Number(parsed.hba1c) >= 6.5) criticalFlags.push('hba1c_alert');
  if (Number(parsed.potassium) >= 5.5) criticalFlags.push('potassium_alert');
  if (Number(parsed.creatinine) >= 2) criticalFlags.push('kidney_alert');
  if (Number(parsed.ldl) >= 160) criticalFlags.push('ldl_alert');

  return {
    mode: 'clinical',
    clinicalFlags: clinicalFlags,
    criticalFlags: criticalFlags
  };
}

function buildLabContext(input) {
  var source = input && typeof input === 'object' ? input : null;
  if (!source) return { mode: 'standard', parsed: null, clinicalFlags: [], criticalFlags: [], isValid: false };

  var parsed = source.parsed && typeof source.parsed === 'object' ? source.parsed : null;
  var clinicalFlags = normalizeClinicalFlags(source.clinicalFlags || source.clinical_flags);
  var criticalFlags = normalizeClinicalFlags(source.criticalFlags || source.critical_flags);
  var isValid = source.isValid === true || source.is_valid === true;
  var mode = resolveDietMode({ parsed: parsed, isValid: isValid });

  if (mode === 'clinical' && !clinicalFlags.length && !criticalFlags.length) {
    var recalculated = applyClinicalRules({ parsed: parsed, isValid: isValid });
    clinicalFlags = recalculated.clinicalFlags;
    criticalFlags = recalculated.criticalFlags;
  }

  return {
    id: source.id || null,
    parsed: parsed,
    confidence: Number(source.confidence || 0),
    isValid: isValid,
    mode: mode,
    clinicalFlags: clinicalFlags,
    criticalFlags: criticalFlags,
    createdAt: source.createdAt || source.created_at || null
  };
}

function hasClinicalFlag(profile, flag) {
  return !!(profile.labContext && Array.isArray(profile.labContext.clinicalFlags) && profile.labContext.clinicalFlags.indexOf(flag) !== -1);
}

function hasCriticalLabFlag(profile) {
  return !!(profile.labContext && Array.isArray(profile.labContext.criticalFlags) && profile.labContext.criticalFlags.length);
}

function shouldAvoidFoodForClinical(food, profile) {
  var name = normalizeFreeText(food && food.name);
  if (!name) return false;
  if (hasClinicalFlag(profile, 'high_potassium') && (/banana|abacate|batata-doce/.test(name))) return true;
  if (hasClinicalFlag(profile, 'high_ldl') && (/patinho/.test(name))) return true;
  if ((hasClinicalFlag(profile, 'pre_diabetes') || hasClinicalFlag(profile, 'glycemic_risk')) && (/mel/.test(name))) return true;
  return false;
}

function getClinicalPenalty(food, profile) {
  var name = normalizeFreeText(food && food.name);
  var penalty = 0;
  if ((hasClinicalFlag(profile, 'pre_diabetes') || hasClinicalFlag(profile, 'glycemic_risk')) && (/granola|pao integral|macarrao/.test(name))) penalty += 4;
  if (hasClinicalFlag(profile, 'high_ldl') && (/ovo|iogurte/.test(name))) penalty += 2;
  return penalty;
}

function applyMedicalAdjustments(profile, targetCalories, macros) {
  var adjustedCalories = targetCalories;
  var adjustedMacros = {
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat
  };

  if (hasCriticalLabFlag(profile)) {
    adjustedCalories = round(profile.getForClinicalSafety || targetCalories);
  }

  return {
    targetCalories: adjustedCalories,
    macros: adjustedMacros
  };
}

function textIncludesAny(text, items) {
  var haystack = normalizeFreeText(text);
  return (items || []).some(function(item) {
    var needle = normalizeFreeText(item);
    return needle && haystack.indexOf(needle) !== -1;
  });
}

function buildNutritionProfile(input) {
  var dietaryPattern = String(input.padraoAlimentar || input.dietaryPattern || '').trim();
  var dislikes = normalizeStringArray(input.alimentosEvitar || input.dislikes);
  var training = input.contextoTreino || input.trainingContext || {};
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
    saude: input.saude || input.healthContext || null,
    nutritionGoals: input.nutritionGoals || null,
    labContext: buildLabContext(input.labContext || (input.saude && input.saude.labContext) || null)
  };
}

function validateProfile(profile) {
  var errors = [];
  if (!profile.sexo) errors.push('sexo ausente');
  if (!profile.idade || profile.idade < 14 || profile.idade > 90) errors.push('idade inválida');
  if (!profile.peso || profile.peso < 35 || profile.peso > 300) errors.push('peso inválido');
  if (!profile.altura || profile.altura < 130 || profile.altura > 230) errors.push('altura inválida');
  return { ok: errors.length === 0, errors: errors };
}

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

function isRestricted(food, restrictions, dislikes) {
  var text = normalizeFreeText((restrictions || []).join(' '));
  if (/vegetarian|vegetariano/.test(text) && /frango|patinho|tilapia/.test(normalizeFreeText(food.name))) return true;
  if (/vegano|vegan/.test(text) && /frango|patinho|tilapia|ovo|iogurte|whey/.test(normalizeFreeText(food.name))) return true;
  if (/lactose|latic/.test(text) && /iogurte|whey/.test(normalizeFreeText(food.name))) return true;
  if (dislikes && textIncludesAny(food.name, dislikes)) return true;
  return false;
}

function isVeganProfile(profile) {
  return /vegano|vegan/.test(normalizeFreeText((profile.restricoesAlimentares || []).join(' ')));
}

function isVegetarianProfile(profile) {
  return /vegetarian|vegetariano/.test(normalizeFreeText((profile.restricoesAlimentares || []).join(' ')));
}

function isPlantProtein(food) {
  return /tofu/.test(normalizeFreeText(food && food.name));
}

function isProteinList(listName) {
  return /proteins$/i.test(String(listName || ''));
}

function cloneScaledMealItem(item, factor) {
  var ratio = Math.max(0.45, Math.min(1.65, Number(factor || 1)));
  return {
    foodCode: item.foodCode,
    nome: item.nome,
    porcao: round(Number(item.gramas || 0) * ratio) + ' g',
    gramas: round(Number(item.gramas || 0) * ratio),
    calorias: round(Number(item.calorias || 0) * ratio),
    proteinas: round(Number(item.proteinas || 0) * ratio, 1),
    carboidratos: round(Number(item.carboidratos || 0) * ratio, 1),
    gorduras: round(Number(item.gorduras || 0) * ratio, 1),
    fibras: round(Number(item.fibras || 0) * ratio, 1),
    source: item.source,
    substituicoes: item.substituicoes || []
  };
}

function selectDistinctFood(listName, profile, index, excludedNames) {
  var excluded = (excludedNames || []).map(normalizeFreeText).filter(Boolean);
  var pool = (FOOD_LIBRARY[listName] || []).filter(function(food) {
    if (isRestricted(food, profile.restricoesAlimentares, profile.alimentosEvitar)) return false;
    if (shouldAvoidFoodForClinical(food, profile)) return false;
    return excluded.indexOf(normalizeFreeText(food.name)) === -1;
  });

  if (!pool.length) return null;
  return chooseFood(listName, Object.assign({}, profile, { _overrideFoodPool: pool }), index);
}

function selectAdjustableItemIndex(items, macroKey, options) {
  var settings = options || {};
  var index = -1;
  var bestScore = -1;
  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    var name = normalizeFreeText(item && item.nome);
    if (!name) continue;
    if (settings.excludeVeggies && /brocolis|salada|legumes|cenoura/.test(name)) continue;
    if (settings.excludeWorkoutFat && /azeite|castanhas|abacate/.test(name)) continue;
    var score = Number(item[macroKey] || 0);
    if (score > bestScore) {
      bestScore = score;
      index = i;
    }
  }
  return index;
}

function rebalanceMealItems(items, target, options) {
  var balanced = (items || []).slice();
  var settings = options || {};

  for (var pass = 0; pass < 4; pass += 1) {
    var subtotal = sumMeal(balanced);
    var proteinGap = round(Number(target.protein || 0) - subtotal.protein, 1);
    var carbGap = round(Number(target.carbs || 0) - subtotal.carbs, 1);
    var fatGap = round(Number(target.fat || 0) - subtotal.fat, 1);

    if (Math.abs(proteinGap) > 2) {
      var proteinIndex = selectAdjustableItemIndex(balanced, 'proteinas', { excludeVeggies: true });
      if (proteinIndex >= 0) {
        var proteinItem = balanced[proteinIndex];
        var proteinFactor = (Number(proteinItem.proteinas || 0) + proteinGap) / Math.max(Number(proteinItem.proteinas || 1), 1);
        balanced[proteinIndex] = cloneScaledMealItem(proteinItem, proteinFactor);
      }
    }

    if (Math.abs(carbGap) > 4) {
      var carbIndex = selectAdjustableItemIndex(balanced, 'carboidratos', { excludeVeggies: true });
      if (carbIndex >= 0) {
        var carbItem = balanced[carbIndex];
        var carbFactor = (Number(carbItem.carboidratos || 0) + carbGap) / Math.max(Number(carbItem.carboidratos || 1), 1);
        balanced[carbIndex] = cloneScaledMealItem(carbItem, carbFactor);
      }
    }

    if (!settings.isWorkoutMeal && Math.abs(fatGap) > 1.5) {
      var fatIndex = selectAdjustableItemIndex(balanced, 'gorduras', { excludeVeggies: true, excludeWorkoutFat: false });
      if (fatIndex >= 0) {
        var fatItem = balanced[fatIndex];
        var fatFactor = (Number(fatItem.gorduras || 0) + fatGap) / Math.max(Number(fatItem.gorduras || 1), 1);
        balanced[fatIndex] = cloneScaledMealItem(fatItem, fatFactor);
      }
    }
  }

  return balanced;
}

function chooseFood(listName, profile, fallbackIndex) {
  var baseItems = Array.isArray(profile && profile._overrideFoodPool) ? profile._overrideFoodPool : (FOOD_LIBRARY[listName] || []);
  var items = baseItems.filter(function(food) {
    return !isRestricted(food, profile.restricoesAlimentares, profile.alimentosEvitar) && !shouldAvoidFoodForClinical(food, profile);
  });
  if (!items.length) items = FOOD_LIBRARY[listName] || [];
  items = items.slice().sort(function(a, b) {
    var aPref = textIncludesAny(a.name, profile.preferencias) ? 1 : 0;
    var bPref = textIncludesAny(b.name, profile.preferencias) ? 1 : 0;
    var aPlant = isPlantProtein(a) ? 1 : 0;
    var bPlant = isPlantProtein(b) ? 1 : 0;
    var aPenalty = getClinicalPenalty(a, profile);
    var bPenalty = getClinicalPenalty(b, profile);
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
    if (!isVeganProfile(profile) && !isVegetarianProfile(profile)) {
      if (aPlant !== bPlant) return aPlant - bPlant;
    }
    return (bPref - aPref) || (aPlant - bPlant);
  });
  if (!isVeganProfile(profile) && !isVegetarianProfile(profile) && isProteinList(listName) && !textIncludesAny('tofu', profile.preferencias)) {
    var animalFirst = items.filter(function(food) { return !isPlantProtein(food); });
    if (animalFirst.length) items = animalFirst;
  }
  var rotationWindow = isProteinList(listName) ? Math.min(items.length, 2) : items.length;
  return items[fallbackIndex % Math.max(rotationWindow, 1)] || null;
}

function cloneFoodItem(food, factor) {
  var ratio = Number(factor || 1);
  return {
    foodCode: food.code,
    nome: food.name,
    porcao: ratio === 1 ? food.portionLabel : (round(food.grams * ratio) + ' g'),
    gramas: round(food.grams * ratio),
    calorias: round(food.calories * ratio),
    proteinas: round(food.protein * ratio, 1),
    carboidratos: round(food.carbs * ratio, 1),
    gorduras: round(food.fat * ratio, 1),
    fibras: round(food.fiber * ratio, 1),
    source: food.source
  };
}

function sumMeal(items) {
  return items.reduce(function(acc, item) {
    acc.calories += Number(item.calorias || 0);
    acc.protein += Number(item.proteinas || 0);
    acc.carbs += Number(item.carboidratos || 0);
    acc.fat += Number(item.gorduras || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function buildSubstitutions(item, profile) {
  var all = [];
  Object.keys(FOOD_LIBRARY).forEach(function(groupName) {
    (FOOD_LIBRARY[groupName] || []).forEach(function(candidate) {
      if (candidate.code !== item.foodCode && !isRestricted(candidate, profile.restricoesAlimentares, profile.alimentosEvitar)) {
        all.push(candidate);
      }
    });
  });
  return all
    .filter(function(candidate) {
      var diff = Math.abs(candidate.protein - item.proteinas) + Math.abs(candidate.carbs - item.carboidratos) + Math.abs(candidate.fat - item.gorduras);
      return diff < 18;
    })
    .slice(0, 2)
    .map(function(candidate) {
      return {
        foodCode: candidate.code,
        nome: candidate.name,
        porcao: candidate.portionLabel,
        calorias: candidate.calories,
        proteinas: candidate.protein,
        carboidratos: candidate.carbs,
        gorduras: candidate.fat
      };
    });
}

function buildMealItems(template, profile, macros, index) {
  var proteinSource;
  var carbSource;
  var supportCarb;
  var fatSource;
  var veggieSource;

  if (/cafe/.test(template.tipo)) {
    proteinSource = chooseFood('breakfastProteins', profile, index);
    carbSource = chooseFood('breakfastCarbs', profile, index);
  } else if (/lanche/.test(template.tipo)) {
    proteinSource = chooseFood('fastProteins', profile, index);
    carbSource = chooseFood('fastCarbs', profile, index);
  } else {
    proteinSource = chooseFood('mealProteins', profile, index);
    carbSource = chooseFood('mealCarbs', profile, index);
  }

  var beanSource = (FOOD_LIBRARY.mealCarbs || []).find(function(food) { return /feijao/.test(normalizeFreeText(food.name)); });
  var riceSource = (FOOD_LIBRARY.mealCarbs || []).find(function(food) { return /arroz/.test(normalizeFreeText(food.name)); });
  var breakfastFruit = (FOOD_LIBRARY.breakfastCarbs || []).find(function(food) { return /banana/.test(normalizeFreeText(food.name)); });
  if (breakfastFruit && shouldAvoidFoodForClinical(breakfastFruit, profile)) breakfastFruit = null;
  var isMainMeal = /almoco|jantar/.test(template.tipo);
  var isBreakfast = /cafe/.test(template.tipo);
  var isSnack = /lanche/.test(template.tipo);
  var isWorkoutMeal = /pre_treino|pos_treino/.test(template.tipo);
  supportCarb = chooseFood('supportCarbs', profile, index);
  fatSource = chooseFood(isBreakfast ? 'breakfastFats' : 'fats', profile, index);
  veggieSource = chooseFood('veggies', profile, index);

  var items = [];
  if (proteinSource) items.push(cloneFoodItem(proteinSource, Math.max(0.8, Math.min(1.45, macros.protein / Math.max(proteinSource.protein, 1)))));

  if (isBreakfast) {
    if (carbSource) items.push(cloneFoodItem(carbSource, Math.max(0.8, Math.min(1.3, (macros.carbs * 0.65) / Math.max(carbSource.carbs, 1)))));
    if (breakfastFruit && breakfastFruit.code !== (carbSource && carbSource.code)) {
      items.push(cloneFoodItem(breakfastFruit, Math.max(0.6, Math.min(1.1, (macros.carbs * 0.2) / Math.max(breakfastFruit.carbs, 1)))));
    }
  } else if (isMainMeal) {
    if (riceSource) items.push(cloneFoodItem(riceSource, Math.max(0.8, Math.min(1.5, (macros.carbs * 0.55) / Math.max(riceSource.carbs, 1)))));
    if (beanSource) items.push(cloneFoodItem(beanSource, Math.max(0.7, Math.min(1.4, (macros.carbs * 0.25) / Math.max(beanSource.carbs, 1)))));
    if (supportCarb && macros.carbs > 28) items.push(cloneFoodItem(supportCarb, Math.max(0.45, Math.min(0.9, (macros.carbs * 0.12) / Math.max(supportCarb.carbs, 1)))));
  } else {
    if (carbSource) items.push(cloneFoodItem(carbSource, Math.max(0.7, Math.min(1.3, (macros.carbs * 0.68) / Math.max(carbSource.carbs, 1)))));
    if (supportCarb && macros.carbs > 25) items.push(cloneFoodItem(supportCarb, Math.max(0.5, Math.min(1.0, (macros.carbs * 0.22) / Math.max(supportCarb.carbs, 1)))));
  }

  if (veggieSource && isMainMeal) items.push(cloneFoodItem(veggieSource, 1));
  if (fatSource && macros.fat > 4 && !isWorkoutMeal) {
    items.push(cloneFoodItem(fatSource, Math.max(0.3, Math.min(isBreakfast ? 0.8 : 1.0, macros.fat / Math.max(fatSource.fat, 1)))));
  }

  items = items.map(function(item) {
    return Object.assign({}, item, {
      substituicoes: buildSubstitutions(item, profile)
    });
  });

  var totals = sumMeal(items);
  var proteinGap = round(macros.protein - totals.protein, 1);
  var carbGap = round(macros.carbs - totals.carbs, 1);

  if (proteinGap > 4) {
    var whey = chooseFood('fastProteins', profile, 0) || chooseFood('breakfastProteins', profile, 0);
    if (whey) items.push(Object.assign({}, cloneFoodItem(whey, Math.max(0.4, proteinGap / Math.max(whey.protein, 1))), {
      substituicoes: buildSubstitutions(cloneFoodItem(whey, 1), profile)
    }));
  }
  if (carbGap > 8 && !isMainMeal) {
    var existingNames = items.map(function(item) { return item.nome; });
    var extraCarb = isBreakfast
      ? (selectDistinctFood('breakfastCarbs', profile, 0, existingNames) || selectDistinctFood('supportCarbs', profile, 0, existingNames))
      : (selectDistinctFood('supportCarbs', profile, 0, existingNames) || selectDistinctFood('fastCarbs', profile, 0, existingNames));
    if (extraCarb) items.push(Object.assign({}, cloneFoodItem(extraCarb, Math.max(0.5, carbGap / Math.max(extraCarb.carbs, 1))), {
      substituicoes: buildSubstitutions(cloneFoodItem(extraCarb, 1), profile)
    }));
  }

  return rebalanceMealItems(items, macros, { isWorkoutMeal: isWorkoutMeal });
}

function getMealTemplates(profile) {
  return MEAL_TEMPLATES[profile.refeicoesPorDia] || MEAL_TEMPLATES[5];
}

function distributeMacrosAcrossMeals(profile, macros) {
  var templates = getMealTemplates(profile);
  return templates.map(function(template, index) {
    return {
      ordem: index + 1,
      tipo: template.tipo,
      nome: template.nome,
      horario: template.horario,
      meta: {
        calories: round((macros.protein * template.proteinShare * 4) + (macros.carbs * template.carbShare * 4) + (macros.fat * template.fatShare * 9)),
        protein: round(macros.protein * template.proteinShare, 1),
        carbs: round(macros.carbs * template.carbShare, 1),
        fat: round(macros.fat * template.fatShare, 1)
      }
    };
  });
}

function buildInitialNutritionPlan(profile, calc) {
  var mealTargets = distributeMacrosAcrossMeals(profile, calc.macros);
  var meals = mealTargets.map(function(target, index) {
    var items = buildMealItems(target, profile, target.meta, index);
    var subtotal = sumMeal(items);
    return {
      ordem: target.ordem,
      tipo: target.tipo,
      nome: target.nome,
      horario: target.horario,
      meta: target.meta,
      subtotal: {
        calorias: round(subtotal.calories),
        proteinas: round(subtotal.protein, 1),
        carboidratos: round(subtotal.carbs, 1),
        gorduras: round(subtotal.fat, 1)
      },
      itens: items
    };
  });

  var planTotals = meals.reduce(function(acc, meal) {
    acc.calories += meal.subtotal.calorias;
    acc.protein += meal.subtotal.proteinas;
    acc.carbs += meal.subtotal.carboidratos;
    acc.fat += meal.subtotal.gorduras;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    objetivo: profile.objetivo,
    caloriasMeta: round(planTotals.calories),
    macrosMeta: {
      protein: round(planTotals.protein, 1),
      carbs: round(planTotals.carbs, 1),
      fat: round(planTotals.fat, 1)
    },
    refeicoesPorDia: profile.refeicoesPorDia,
    resumoDiario: {
      calorias: round(planTotals.calories),
      proteinas: round(planTotals.protein, 1),
      carboidratos: round(planTotals.carbs, 1),
      gorduras: round(planTotals.fat, 1)
    },
    refeicoes: meals
  };
}

function limitedOrientation(profile, validation) {
  return {
    limited: true,
    reason: 'Dados insuficientes ou inconsistentes para plano completo.',
    inconsistencias: validation.errors,
    orientacao: 'Complete sexo, idade, peso e altura válidos para personalizar a dieta. Casos clínicos, uso de medicação ou sintomas gastrointestinais relevantes exigem nutricionista.',
    objetivoSolicitado: profile.objetivo
  };
}

function calculateNutrition(profileInput) {
  var profile = buildNutritionProfile(profileInput || {});
  var validation = validateProfile(profile);

  if (!validation.ok) {
    return {
      profile: profile,
      failSafe: true,
      limitedOrientation: limitedOrientation(profile, validation)
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
  var clinicalAdjusted = applyMedicalAdjustments(profile, rawTargetCalories, macros);

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
    }
  };
}

function generateNutritionPlan(profileInput) {
  var calc = calculateNutrition(profileInput);
  if (calc.failSafe) return calc;

  var plan = buildInitialNutritionPlan(calc.profile, calc.result);
  var clinicalNotes = [];
  if (calc.profile.labContext && calc.profile.labContext.mode === 'clinical') {
    clinicalNotes.push('Plano ajustado com base no seu exame recente.');
    if (hasClinicalFlag(calc.profile, 'pre_diabetes') || hasClinicalFlag(calc.profile, 'glycemic_risk')) {
      clinicalNotes.push('Carboidratos distribuídos de forma mais estável ao longo do dia, com menor ênfase em fontes refinadas.');
    }
    if (hasClinicalFlag(calc.profile, 'high_potassium')) {
      clinicalNotes.push('Foram evitados alimentos com maior carga de potássio, como banana, abacate e batata-doce.');
    }
    if (hasClinicalFlag(calc.profile, 'high_ldl')) {
      clinicalNotes.push('Foram priorizadas fontes proteicas mais magras e fibras alimentares para um plano mais conservador.');
    }
    if (hasCriticalLabFlag(calc.profile)) {
      clinicalNotes.push('Valores críticos recentes mantiveram o plano em modo conservador, sem estratégia agressiva de cutting ou bulking.');
    }
  }
  return {
    profile: calc.profile,
    failSafe: false,
    formulas: calc.formulas,
    calculation: {
      tmb: calc.result.tmb,
      get: calc.result.get,
      targetCalories: plan.resumoDiario.calorias,
      macros: {
        protein: plan.resumoDiario.proteinas,
        carbs: plan.resumoDiario.carboidratos,
        fat: plan.resumoDiario.gorduras
      },
      activityFactor: calc.result.activityFactor,
      objective: calc.result.objective
    },
    plan: plan,
    clinicalContext: {
      mode: calc.profile.labContext.mode,
      clinicalFlags: calc.profile.labContext.clinicalFlags,
      criticalFlags: calc.profile.labContext.criticalFlags,
      summaryMessage: clinicalNotes[0] || null,
      reportDate: calc.profile.labContext.createdAt || null,
      confidence: calc.profile.labContext.confidence || 0
    },
    clinicalSafety: 'Plano esportivo educacional. Não substitui conduta clínica, terapêutica ou nutricional individualizada em casos complexos.',
    clinicalNotes: clinicalNotes
  };
}

module.exports = {
  ACTIVITY_FACTORS: ACTIVITY_FACTORS,
  FOOD_LIBRARY: FOOD_LIBRARY,
  buildNutritionProfile: buildNutritionProfile,
  resolveDietMode: resolveDietMode,
  applyClinicalRules: applyClinicalRules,
  applyMedicalAdjustments: applyMedicalAdjustments,
  calculateNutrition: calculateNutrition,
  generateNutritionPlan: generateNutritionPlan,
  round: round
};
