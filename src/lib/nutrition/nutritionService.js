'use strict';

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var f = Math.pow(10, d);
  return Math.round(Number(value || 0) * f) / f;
}

var ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  ativo: 1.725,
  muito_ativo: 1.9
};

var OBJECTIVE_CONFIG = {
  emagrecimento: { calorieDelta: -0.15, proteinPerKg: 2.2, fatPerKg: 0.8 },
  manutencao: { calorieDelta: 0, proteinPerKg: 1.8, fatPerKg: 0.9 },
  hipertrofia: { calorieDelta: 0.1, proteinPerKg: 2.0, fatPerKg: 0.9 },
  recomposicao: { calorieDelta: -0.05, proteinPerKg: 2.2, fatPerKg: 0.85 }
};

var DEFAULT_MEAL_SPLIT = {
  3: [0.3, 0.4, 0.3],
  4: [0.25, 0.35, 0.15, 0.25],
  5: [0.22, 0.3, 0.13, 0.15, 0.2],
  6: [0.2, 0.25, 0.1, 0.15, 0.1, 0.2]
};

var MEAL_NAMES = ['Café da manhã', 'Lanche manhã', 'Almoço', 'Lanche tarde', 'Jantar', 'Ceia'];

var FOOD_CATALOG = [
  { code: 'frango_120', group: 'proteina_magra', name: 'Frango grelhado', portionLabel: '120 g', grams: 120, calories: 198, protein: 37, carbs: 0, fat: 4, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
  { code: 'patinho_120', group: 'proteina_magra', name: 'Patinho grelhado', portionLabel: '120 g', grams: 120, calories: 225, protein: 34, carbs: 0, fat: 10, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
  { code: 'tofu_150', group: 'proteina_veg', name: 'Tofu firme', portionLabel: '150 g', grams: 150, calories: 144, protein: 15, carbs: 4, fat: 8, fiber: 2, source: 'USDA FoodData Central (adaptado)' },
  { code: 'ovo_2', group: 'proteina_ovos', name: 'Ovo inteiro', portionLabel: '2 un', grams: 100, calories: 143, protein: 12, carbs: 1, fat: 10, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
  { code: 'arroz_120', group: 'carbo_complexo', name: 'Arroz cozido', portionLabel: '120 g', grams: 120, calories: 156, protein: 3, carbs: 34, fat: 0.4, fiber: 0.4, source: 'TACO/USDA (adaptado)' },
  { code: 'batata_doce_130', group: 'carbo_complexo', name: 'Batata-doce cozida', portionLabel: '130 g', grams: 130, calories: 112, protein: 2, carbs: 26, fat: 0.1, fiber: 3.3, source: 'TACO/USDA (adaptado)' },
  { code: 'aveia_40', group: 'carbo_fibra', name: 'Aveia', portionLabel: '40 g', grams: 40, calories: 156, protein: 6.8, carbs: 26.5, fat: 3.4, fiber: 4.2, source: 'USDA FoodData Central (adaptado)' },
  { code: 'banana_1', group: 'fruta', name: 'Banana', portionLabel: '1 un média', grams: 90, calories: 80, protein: 1, carbs: 20.7, fat: 0.2, fiber: 2.1, source: 'TACO (adaptado)' },
  { code: 'feijao_100', group: 'leguminosa', name: 'Feijão cozido', portionLabel: '100 g', grams: 100, calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5, source: 'TACO (adaptado)' },
  { code: 'azeite_10', group: 'gordura', name: 'Azeite de oliva', portionLabel: '10 g', grams: 10, calories: 88, protein: 0, carbs: 0, fat: 10, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
  { code: 'abacate_100', group: 'gordura', name: 'Abacate', portionLabel: '100 g', grams: 100, calories: 96, protein: 1.2, carbs: 6, fat: 8.4, fiber: 6.3, source: 'TACO (adaptado)' },
  { code: 'brocolis_100', group: 'vegetal', name: 'Brócolis cozido', portionLabel: '100 g', grams: 100, calories: 25, protein: 3, carbs: 4.4, fat: 0.5, fiber: 3.4, source: 'TACO (adaptado)' },
  { code: 'iogurte_170', group: 'laticinio', name: 'Iogurte natural', portionLabel: '170 g', grams: 170, calories: 104, protein: 6, carbs: 8, fat: 5, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
  { code: 'whey_30', group: 'suplemento', name: 'Whey protein', portionLabel: '30 g', grams: 30, calories: 120, protein: 24, carbs: 3, fat: 2, fiber: 0, source: 'Rótulos médios de mercado (referência)' }
];

function normalizeObjective(input) {
  var raw = String(input || '').toLowerCase();
  if (/emagrec|perder/.test(raw)) return 'emagrecimento';
  if (/hipertrof|ganhar|massa/.test(raw)) return 'hipertrofia';
  if (/recompos/.test(raw)) return 'recomposicao';
  return 'manutencao';
}

function normalizeActivity(input, rotina, frequencia) {
  var raw = String(input || rotina || '').toLowerCase();
  var days = parseInt(String(frequencia || ''), 10);
  if (!isNaN(days)) {
    if (days <= 1) return 'leve';
    if (days <= 3) return 'moderado';
    if (days <= 5) return 'ativo';
    return 'muito_ativo';
  }
  if (/sedent/.test(raw)) return 'sedentario';
  if (/leve|caminhad/.test(raw)) return 'leve';
  if (/muito|intens|fisic/.test(raw)) return 'muito_ativo';
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
  if (Array.isArray(input)) return input.filter(Boolean).map(function(v) { return String(v).trim(); }).filter(Boolean);
  return String(input).split(',').map(function(v) { return v.trim(); }).filter(Boolean);
}

function normalizeFreeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
  var profile = {
    sexo: normalizeSex(input.sexo),
    idade: Number(input.idade),
    peso: Number(input.peso),
    altura: Number(input.altura),
    objetivo: normalizeObjective(input.objetivo),
    nivelAtividade: normalizeActivity(input.nivelAtividade || input.nivel_atividade, input.rotina, input.frequencia),
    restricoesAlimentares: normalizeStringArray(input.restricoesAlimentares || input.restricoes).concat(dietaryPattern ? [dietaryPattern] : []),
    preferencias: normalizeStringArray(input.preferencias),
    alimentosEvitar: dislikes,
    refeicoesPorDia: Math.min(6, Math.max(3, Number(input.refeicoesPorDia || input.refeicoes_por_dia || 4))),
    usoSuplementos: normalizeStringArray(input.usoSuplementos || input.suplementos),
    observacoes: String(input.observacoes || '').trim(),
    padraoAlimentar: dietaryPattern || null,
    bodyFatPercent: input.gorduraCorporal || input.bodyFatPercent || null,
    biotipo: String(input.biotipo || '').trim() || null,
    contextoTreino: input.contextoTreino || input.trainingContext || null,
    saude: input.saude || input.healthContext || null,
    nutritionGoals: input.nutritionGoals || null
  };

  return profile;
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

function calculateMacroTargets(profile, targetCalories) {
  var config = OBJECTIVE_CONFIG[profile.objetivo] || OBJECTIVE_CONFIG.manutencao;
  var protein = round(profile.peso * config.proteinPerKg, 1);
  var fat = round(profile.peso * config.fatPerKg, 1);
  var carbs = round((targetCalories - (protein * 4) - (fat * 9)) / 4, 1);

  if (carbs < 70) {
    carbs = 70;
    protein = round((targetCalories - (fat * 9) - (carbs * 4)) / 4, 1);
  }

  return { protein: protein, carbs: carbs, fat: fat };
}

function applyObjectiveToCalories(get, objective) {
  var config = OBJECTIVE_CONFIG[objective] || OBJECTIVE_CONFIG.manutencao;
  return round(get * (1 + config.calorieDelta));
}

function isRestricted(food, restrictions, dislikes) {
  var text = restrictions.join(' ').toLowerCase();
  var disliked = (dislikes || []).join(' ').toLowerCase();
  if (/vegetarian|vegetariano/.test(text) && /frango|patinho/.test(food.name.toLowerCase())) return true;
  if (/vegano|vegan/.test(text) && /frango|patinho|ovo|iogurte|whey/.test(food.name.toLowerCase())) return true;
  if (/lactose|latic/.test(text) && /iogurte|whey/.test(food.name.toLowerCase())) return true;
  if (disliked && textIncludesAny(food.name, dislikes)) return true;
  return false;
}

function getFoodsByGroup(group, profile) {
  var restrictions = profile && Array.isArray(profile.restricoesAlimentares) ? profile.restricoesAlimentares : [];
  var dislikes = profile && Array.isArray(profile.alimentosEvitar) ? profile.alimentosEvitar : [];
  var preferences = profile && Array.isArray(profile.preferencias) ? profile.preferencias : [];

  return FOOD_CATALOG
    .filter(function(food) {
      return food.group === group && !isRestricted(food, restrictions, dislikes);
    })
    .sort(function(a, b) {
      var aPreferred = textIncludesAny(a.name, preferences) ? 1 : 0;
      var bPreferred = textIncludesAny(b.name, preferences) ? 1 : 0;
      return bPreferred - aPreferred;
    });
}

function allocateMealTargets(total, split, index) {
  var pct = split[index];
  return {
    calories: round(total.calories * pct),
    protein: round(total.protein * pct, 1),
    carbs: round(total.carbs * pct, 1),
    fat: round(total.fat * pct, 1)
  };
}

function buildMealItems(target, profile) {
  var proteinFood = getFoodsByGroup('proteina_magra', profile)[0] || getFoodsByGroup('proteina_veg', profile)[0] || getFoodsByGroup('proteina_ovos', profile)[0];
  var carbFood = getFoodsByGroup('carbo_complexo', profile)[0] || getFoodsByGroup('carbo_fibra', profile)[0];
  var veggie = getFoodsByGroup('vegetal', profile)[0];
  var fatFood = getFoodsByGroup('gordura', profile)[0];

  var items = [];
  if (proteinFood) items.push(proteinFood);
  if (carbFood) items.push(carbFood);
  if (veggie) items.push(veggie);
  if (fatFood && target.fat > 8) items.push(fatFood);
  if ((profile.usoSuplementos || []).some(function(s) { return /whey/.test(s.toLowerCase()); })) {
    var whey = FOOD_CATALOG.find(function(food) { return food.code === 'whey_30'; });
    if (whey && target.protein >= 30) items.push(whey);
  }

  return items;
}

function nearestSubstitutions(item, restrictions) {
  return FOOD_CATALOG
    .filter(function(candidate) {
      return candidate.group === item.group && candidate.code !== item.code && !isRestricted(candidate, restrictions || []);
    })
    .map(function(candidate) {
      var calorieDiff = Math.abs(candidate.calories - item.calories);
      var macroDiff = Math.abs(candidate.protein - item.protein) + Math.abs(candidate.carbs - item.carbs) + Math.abs(candidate.fat - item.fat);
      return { candidate: candidate, score: calorieDiff + macroDiff };
    })
    .sort(function(a, b) { return a.score - b.score; })
    .slice(0, 2)
    .map(function(row) {
      return {
        foodCode: row.candidate.code,
        nome: row.candidate.name,
        porcao: row.candidate.portionLabel,
        calorias: row.candidate.calories,
        proteinas: row.candidate.protein,
        carboidratos: row.candidate.carbs,
        gorduras: row.candidate.fat
      };
    });
}

function buildInitialNutritionPlan(profile, calc) {
  var split = DEFAULT_MEAL_SPLIT[profile.refeicoesPorDia] || DEFAULT_MEAL_SPLIT[4];
  var meals = split.map(function(_, index) {
    var mealTarget = allocateMealTargets({
      calories: calc.targetCalories,
      protein: calc.macros.protein,
      carbs: calc.macros.carbs,
      fat: calc.macros.fat
    }, split, index);

    var items = buildMealItems(mealTarget, profile);

    return {
      ordem: index + 1,
      nome: MEAL_NAMES[index],
      meta: mealTarget,
      itens: items.map(function(item, itemIndex) {
        return {
          ordem: itemIndex + 1,
          foodCode: item.code,
          nome: item.name,
          porcao: item.portionLabel,
          gramas: item.grams,
          calorias: item.calories,
          proteinas: item.protein,
          carboidratos: item.carbs,
          gorduras: item.fat,
          fibras: item.fiber,
          substituicoes: nearestSubstitutions(item, profile.restricoesAlimentares)
        };
      })
    };
  });

  return {
    objetivo: profile.objetivo,
    caloriasMeta: calc.targetCalories,
    macrosMeta: calc.macros,
    refeicoesPorDia: profile.refeicoesPorDia,
    refeicoes: meals
  };
}

function limitedOrientation(profile, validation) {
  return {
    limited: true,
    reason: 'Dados insuficientes ou inconsistentes para plano completo.',
    inconsistencias: validation.errors,
    orientacao: 'Para segurança, complete sexo, idade, peso e altura válidos. Em caso de comorbidades, gestação, uso de medicação ou sintomas gastrointestinais relevantes, procure nutricionista para conduta individualizada.',
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
  var targetCalories = applyObjectiveToCalories(get, profile.objetivo);
  var macros = calculateMacroTargets(profile, targetCalories);

  return {
    profile: profile,
    failSafe: false,
    formulas: {
      tmb: 'Mifflin-St Jeor',
      get: 'GET = TMB * fator de atividade',
      macros: 'Proteína e gordura por kg; carboidrato por calorias restantes'
    },
    result: {
      tmb: bmr,
      get: get,
      targetCalories: targetCalories,
      macros: macros,
      activityFactor: ACTIVITY_FACTORS[profile.nivelAtividade],
      objective: profile.objetivo
    }
  };
}

function generateNutritionPlan(profileInput) {
  var calc = calculateNutrition(profileInput);
  if (calc.failSafe) return calc;

  var plan = buildInitialNutritionPlan(calc.profile, calc.result);
  return {
    profile: calc.profile,
    failSafe: false,
    formulas: calc.formulas,
    calculation: calc.result,
    plan: plan,
    clinicalSafety: 'Sem conduta clínica/terapêutica. Casos complexos devem ser encaminhados para nutricionista.'
  };
}

module.exports = {
  ACTIVITY_FACTORS: ACTIVITY_FACTORS,
  FOOD_CATALOG: FOOD_CATALOG,
  buildNutritionProfile: buildNutritionProfile,
  calculateNutrition: calculateNutrition,
  generateNutritionPlan: generateNutritionPlan,
  round: round
};
