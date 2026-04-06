'use strict';

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function sum(list, getter) {
  return (Array.isArray(list) ? list : []).reduce(function(total, item, index) {
    return total + Number(getter ? getter(item, index) : item || 0);
  }, 0);
}

function normalizeFreeText(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeStringArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  }
  return String(input)
    .split(',')
    .map(function(item) { return item.trim(); })
    .filter(Boolean);
}

function textIncludesAny(text, candidates) {
  var haystack = normalizeFreeText(text);
  return normalizeStringArray(candidates).some(function(candidate) {
    var needle = normalizeFreeText(candidate);
    return needle && haystack.indexOf(needle) >= 0;
  });
}

var ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  ativo: 1.725,
  muito_ativo: 1.9
};

var OBJECTIVE_CONFIG = {
  emagrecimento: { calorieDelta: -0.18, proteinPerKg: 2.2, fatPerKg: 0.7, carbBias: 'low' },
  manutencao: { calorieDelta: 0, proteinPerKg: 1.8, fatPerKg: 0.8, carbBias: 'moderate' },
  hipertrofia: { calorieDelta: 0.1, proteinPerKg: 2.0, fatPerKg: 0.8, carbBias: 'high' },
  recomposicao: { calorieDelta: -0.05, proteinPerKg: 2.2, fatPerKg: 0.7, carbBias: 'moderate' },
  forca: { calorieDelta: 0.05, proteinPerKg: 2.0, fatPerKg: 0.8, carbBias: 'high' }
};

var MEAL_NAME_BY_TYPE = {
  breakfast: 'Café da manhã',
  morning_snack: 'Lanche da manhã',
  lunch: 'Almoço',
  pre_workout: 'Pré-treino',
  post_workout: 'Pós-treino / Jantar',
  dinner: 'Jantar',
  supper: 'Ceia'
};

var DEFAULT_HOURS_BY_TYPE = {
  breakfast: '07:00',
  morning_snack: '10:00',
  lunch: '13:00',
  pre_workout: '16:30',
  post_workout: '20:00',
  dinner: '20:00',
  supper: '22:30'
};

var FOOD_CATALOG = [
  { code: 'ovo', group: 'protein_breakfast', subGroup: 'egg', name: 'Ovo inteiro', portionUnit: 50, portionLabel: '1 un', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0, tags: ['breakfast'] },
  { code: 'whey', group: 'protein_fast', subGroup: 'powder', name: 'Whey protein', portionUnit: 10, portionLabel: '10 g', calories: 40, protein: 8, carbs: 1, fat: 0.7, fiber: 0, tags: ['breakfast', 'snack', 'pre_workout', 'post_workout'] },
  { code: 'proteina_veg', group: 'protein_fast', subGroup: 'powder', name: 'Proteína vegetal', portionUnit: 10, portionLabel: '10 g', calories: 39, protein: 7.5, carbs: 1.3, fat: 0.6, fiber: 0.2, tags: ['breakfast', 'snack', 'pre_workout', 'post_workout'], vegan: true },
  { code: 'frango', group: 'protein_meal', subGroup: 'lean_meat', name: 'Frango grelhado', portionUnit: 10, portionLabel: '10 g', calories: 16.5, protein: 3.1, carbs: 0, fat: 0.36, fiber: 0, tags: ['lunch', 'post_workout', 'dinner'] },
  { code: 'patinho', group: 'protein_meal', subGroup: 'red_meat', name: 'Patinho grelhado', portionUnit: 10, portionLabel: '10 g', calories: 18, protein: 2.8, carbs: 0, fat: 0.8, fiber: 0, tags: ['lunch', 'dinner'] },
  { code: 'atum', group: 'protein_meal', subGroup: 'fish', name: 'Atum em água', portionUnit: 10, portionLabel: '10 g', calories: 11.6, protein: 2.6, carbs: 0, fat: 0.1, fiber: 0, tags: ['lunch', 'post_workout', 'dinner'] },
  { code: 'tofu', group: 'protein_meal', subGroup: 'vegan', name: 'Tofu firme', portionUnit: 10, portionLabel: '10 g', calories: 7.6, protein: 0.8, carbs: 0.3, fat: 0.45, fiber: 0.2, tags: ['breakfast', 'lunch', 'dinner'], vegan: true },
  { code: 'iogurte', group: 'protein_snack', subGroup: 'dairy', name: 'Iogurte grego natural', portionUnit: 10, portionLabel: '10 g', calories: 5.9, protein: 1.0, carbs: 0.36, fat: 0.04, fiber: 0, tags: ['snack', 'breakfast'] },
  { code: 'aveia', group: 'carb', subGroup: 'grain', name: 'Aveia', portionUnit: 10, portionLabel: '10 g', calories: 38.9, protein: 1.69, carbs: 6.63, fat: 0.69, fiber: 1.06, tags: ['breakfast', 'snack', 'pre_workout'] },
  { code: 'pao', group: 'carb', subGroup: 'bread', name: 'Pão integral', portionUnit: 30, portionLabel: '1 fatia', calories: 74, protein: 2.7, carbs: 13.6, fat: 1.0, fiber: 1.7, tags: ['breakfast', 'snack', 'pre_workout'] },
  { code: 'banana', group: 'carb', subGroup: 'fruit', name: 'Banana', portionUnit: 10, portionLabel: '10 g', calories: 8.9, protein: 0.11, carbs: 2.3, fat: 0.03, fiber: 0.26, tags: ['breakfast', 'snack', 'pre_workout', 'post_workout'] },
  { code: 'arroz', group: 'carb', subGroup: 'starch', name: 'Arroz cozido', portionUnit: 10, portionLabel: '10 g', calories: 13, protein: 0.27, carbs: 2.8, fat: 0.03, fiber: 0.04, tags: ['lunch', 'post_workout', 'dinner'] },
  { code: 'batata_doce', group: 'carb', subGroup: 'starch', name: 'Batata-doce cozida', portionUnit: 10, portionLabel: '10 g', calories: 8.6, protein: 0.16, carbs: 2, fat: 0.05, fiber: 0.3, tags: ['lunch', 'post_workout', 'dinner'] },
  { code: 'feijao', group: 'carb_support', subGroup: 'legume', name: 'Feijão cozido', portionUnit: 10, portionLabel: '10 g', calories: 7.7, protein: 0.48, carbs: 1.36, fat: 0.05, fiber: 0.85, tags: ['lunch', 'dinner'], vegan: true },
  { code: 'pasta_amendoim', group: 'fat', subGroup: 'nut_butter', name: 'Pasta de amendoim', portionUnit: 5, portionLabel: '5 g', calories: 29.4, protein: 1.25, carbs: 1.0, fat: 2.5, fiber: 0.3, tags: ['breakfast', 'snack'] },
  { code: 'castanhas', group: 'fat', subGroup: 'nuts', name: 'Castanhas', portionUnit: 5, portionLabel: '5 g', calories: 30, protein: 1, carbs: 1.1, fat: 2.7, fiber: 0.5, tags: ['snack', 'supper'] },
  { code: 'azeite', group: 'fat', subGroup: 'oil', name: 'Azeite de oliva', portionUnit: 1, portionLabel: '1 g', calories: 8.8, protein: 0, carbs: 0, fat: 1, fiber: 0, tags: ['lunch', 'dinner', 'post_workout'] },
  { code: 'abacate', group: 'fat', subGroup: 'fruit_fat', name: 'Abacate', portionUnit: 10, portionLabel: '10 g', calories: 9.6, protein: 0.12, carbs: 0.6, fat: 0.84, fiber: 0.63, tags: ['breakfast', 'snack', 'supper'], vegan: true },
  { code: 'brocolis', group: 'vegetable', subGroup: 'green', name: 'Brócolis cozido', portionUnit: 10, portionLabel: '10 g', calories: 2.5, protein: 0.3, carbs: 0.44, fat: 0.05, fiber: 0.34, tags: ['lunch', 'dinner', 'post_workout'], vegan: true },
  { code: 'salada', group: 'vegetable', subGroup: 'salad', name: 'Salada verde', portionUnit: 10, portionLabel: '10 g', calories: 1.5, protein: 0.1, carbs: 0.2, fat: 0.02, fiber: 0.12, tags: ['lunch', 'dinner'], vegan: true }
];

var SUBSTITUTION_GROUPS = {
  egg: ['ovo'],
  powder: ['whey', 'proteina_veg'],
  lean_meat: ['frango', 'atum', 'patinho', 'tofu'],
  red_meat: ['patinho', 'frango', 'atum', 'tofu'],
  fish: ['atum', 'frango', 'patinho', 'tofu'],
  vegan: ['tofu', 'proteina_veg'],
  dairy: ['iogurte', 'whey'],
  grain: ['aveia', 'pao', 'arroz', 'batata_doce'],
  bread: ['pao', 'aveia', 'banana'],
  fruit: ['banana', 'batata_doce', 'arroz'],
  starch: ['arroz', 'batata_doce', 'pao'],
  legume: ['feijao', 'arroz', 'batata_doce'],
  nut_butter: ['pasta_amendoim', 'castanhas', 'abacate'],
  nuts: ['castanhas', 'pasta_amendoim', 'abacate'],
  oil: ['azeite', 'abacate'],
  fruit_fat: ['abacate', 'castanhas', 'pasta_amendoim'],
  green: ['brocolis', 'salada'],
  salad: ['salada', 'brocolis']
};

function normalizeObjective(input) {
  var raw = normalizeFreeText(input);
  if (/emagrec|cut|perder/.test(raw)) return 'emagrecimento';
  if (/hipertrof|ganho|massa|bulking|bulk/.test(raw)) return 'hipertrofia';
  if (/recompos/.test(raw)) return 'recomposicao';
  if (/forca|strength/.test(raw)) return 'forca';
  return 'manutencao';
}

function normalizeActivity(input, rotina, frequencia) {
  var raw = normalizeFreeText(input || rotina);
  var frequencyText = normalizeFreeText(frequencia);
  var days = parseInt(String(frequencia || '').replace(/[^\d]/g, ''), 10);
  if (!isNaN(days)) {
    if (days <= 1) return 'leve';
    if (days <= 3) return 'moderado';
    if (days <= 5) return 'ativo';
    return 'muito_ativo';
  }
  if (/sedent/.test(raw)) return 'sedentario';
  if (/leve|caminhad/.test(raw)) return 'leve';
  if (/muito|intens|atleta/.test(raw) || /6x|7x/.test(frequencyText)) return 'muito_ativo';
  if (/ativo|moder/.test(raw) || /4x|5x/.test(frequencyText)) return /ativo/.test(raw) ? 'ativo' : 'moderado';
  return 'moderado';
}

function normalizeSex(input) {
  var raw = normalizeFreeText(input);
  if (!raw) return null;
  if (/^(f|fem|feminino|female|mulher|woman)$/.test(raw)) return 'feminino';
  if (/^(m|masc|masculino|male|homem|man)$/.test(raw)) return 'masculino';
  return null;
}

function parseTrainingHour(context) {
  var candidates = [];
  if (context && typeof context === 'object') {
    candidates.push(context.horario);
    candidates.push(context.hora);
    candidates.push(context.schedule);
    candidates.push(context.window);
    candidates.push(context.observacao);
  }
  var allText = candidates.filter(Boolean).join(' ');
  var match = allText.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return String(match[1]).padStart(2, '0') + ':' + match[2];
  }
  return '18:00';
}

function buildNutritionProfile(input) {
  var dietaryPattern = String(input.padraoAlimentar || input.dietaryPattern || '').trim();
  var dislikes = normalizeStringArray(input.alimentosEvitar || input.dislikes);
  return {
    sexo: normalizeSex(input.sexo || input.sex),
    idade: Number(input.idade || input.age),
    peso: Number(input.peso || input.pesoKg || input.weightKg || input.weight),
    altura: Number(input.altura || input.alturaCm || input.heightCm || input.height),
    objetivo: normalizeObjective(input.objetivo || input.objective),
    nivelAtividade: normalizeActivity(input.nivelAtividade || input.activityLevel || input.nivel_atividade, input.rotina || input.routine, input.frequenciaTreino || input.frequencia),
    restricoesAlimentares: normalizeStringArray(input.restricoesAlimentares || input.restricoes || input.restrictions).concat(dietaryPattern ? [dietaryPattern] : []),
    preferencias: normalizeStringArray(input.preferencias || input.preferences),
    alimentosEvitar: dislikes,
    refeicoesPorDia: Math.min(6, Math.max(3, Number(input.refeicoesPorDia || input.refeicoes_por_dia || input.meals || 4))),
    usoSuplementos: normalizeStringArray(input.usoSuplementos || input.suplementos || input.supplements),
    observacoes: String(input.observacoes || input.notes || '').trim(),
    padraoAlimentar: dietaryPattern || null,
    bodyFatPercent: input.gorduraCorporal || input.bodyFatPercent || null,
    biotipo: String(input.biotipo || '').trim() || null,
    contextoTreino: input.contextoTreino || input.trainingContext || null,
    saude: input.saude || input.healthContext || null,
    nutritionGoals: input.nutritionGoals || null,
    horarioTreino: parseTrainingHour(input.contextoTreino || input.trainingContext || null)
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
  return round(bmr * (ACTIVITY_FACTORS[profile.nivelAtividade] || ACTIVITY_FACTORS.moderado), 2);
}

function applyObjectiveToCalories(get, objective) {
  var config = OBJECTIVE_CONFIG[objective] || OBJECTIVE_CONFIG.manutencao;
  return round(get * (1 + config.calorieDelta));
}

function calculateMacroTargets(profile, targetCalories) {
  var config = OBJECTIVE_CONFIG[profile.objetivo] || OBJECTIVE_CONFIG.manutencao;
  var protein = round(clamp(profile.peso * config.proteinPerKg, profile.peso * 1.6, profile.peso * 2.2), 1);
  var fat = round(clamp(profile.peso * config.fatPerKg, profile.peso * 0.6, profile.peso * 1.0), 1);
  var carbs = round(Math.max(0, (targetCalories - (protein * 4) - (fat * 9)) / 4), 1);

  if (carbs < 1) {
    carbs = 1;
    targetCalories = round((protein * 4) + (fat * 9) + (carbs * 4));
  }

  return {
    protein: protein,
    carbs: carbs,
    fat: fat,
    calories: round((protein * 4) + (carbs * 4) + (fat * 9))
  };
}

function isPatternRestricted(food, restrictions) {
  var joined = normalizeFreeText((restrictions || []).join(' '));
  if (/vegano|vegan/.test(joined) && !food.vegan) return /frango|patinho|ovo|iogurte|atum|whey/.test(normalizeFreeText(food.name));
  if (/vegetariano|vegetarian/.test(joined) && /frango|patinho|atum/.test(normalizeFreeText(food.name))) return true;
  if (/lactose|latic/.test(joined) && /iogurte|whey/.test(normalizeFreeText(food.name))) return true;
  return false;
}

function isRestricted(food, profile) {
  if (isPatternRestricted(food, profile.restricoesAlimentares)) return true;
  if (textIncludesAny(food.name, profile.alimentosEvitar)) return true;
  return false;
}

function getFoodsByCodes(codes, profile) {
  var preferences = profile && Array.isArray(profile.preferencias) ? profile.preferencias : [];
  return (codes || [])
    .map(function(code) {
      return FOOD_CATALOG.find(function(food) { return food.code === code; }) || null;
    })
    .filter(Boolean)
    .filter(function(food) { return !isRestricted(food, profile); })
    .sort(function(a, b) {
      var aPreferred = textIncludesAny(a.name, preferences) ? 1 : 0;
      var bPreferred = textIncludesAny(b.name, preferences) ? 1 : 0;
      return bPreferred - aPreferred;
    });
}

function selectFood(codes, profile, fallbackCode) {
  var pool = getFoodsByCodes(codes, profile);
  if (pool[0]) return pool[0];
  return FOOD_CATALOG.find(function(food) { return food.code === fallbackCode; }) || null;
}

function formatPortion(food, units) {
  var totalGrams = round(food.portionUnit * units);
  if (food.code === 'ovo') {
    return round(units) + ' un';
  }
  if (food.code === 'pao') {
    return round(units, 1) + ' fatia(s)';
  }
  if (food.code === 'azeite') {
    return totalGrams + ' g';
  }
  return totalGrams + ' g';
}

function scaleFood(food, units) {
  var safeUnits = Math.max(0, Number(units || 0));
  return {
    foodCode: food.code,
    nome: food.name,
    porcao: formatPortion(food, safeUnits),
    gramas: round(food.portionUnit * safeUnits),
    calorias: round(food.calories * safeUnits, 1),
    proteinas: round(food.protein * safeUnits, 1),
    carboidratos: round(food.carbs * safeUnits, 1),
    gorduras: round(food.fat * safeUnits, 1),
    fibras: round(food.fiber * safeUnits, 1),
    subGroup: food.subGroup
  };
}

function addScaledItem(items, food, units) {
  if (!food || !Number.isFinite(Number(units)) || Number(units) <= 0) return;
  items.push(scaleFood(food, units));
}

function getMealBlueprints(count, trainingHour) {
  var blueprintsByCount = {
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'pre_workout', 'post_workout'],
    5: ['breakfast', 'morning_snack', 'lunch', 'pre_workout', 'post_workout'],
    6: ['breakfast', 'morning_snack', 'lunch', 'pre_workout', 'post_workout', 'supper']
  };
  var types = blueprintsByCount[count] || blueprintsByCount[4];
  var trainHour = String(trainingHour || '18:00');
  var trainParts = trainHour.split(':');
  var trainMinutes = (parseInt(trainParts[0], 10) * 60) + parseInt(trainParts[1], 10);

  return types.map(function(type) {
    var hour = DEFAULT_HOURS_BY_TYPE[type];
    if (type === 'pre_workout') {
      var preMinutes = Math.max(360, trainMinutes - 90);
      hour = String(Math.floor(preMinutes / 60)).padStart(2, '0') + ':' + String(preMinutes % 60).padStart(2, '0');
    } else if (type === 'post_workout') {
      var postMinutes = Math.min(1380, trainMinutes + 90);
      hour = String(Math.floor(postMinutes / 60)).padStart(2, '0') + ':' + String(postMinutes % 60).padStart(2, '0');
    }
    return {
      type: type,
      nome: MEAL_NAME_BY_TYPE[type],
      horario: hour,
      tag: type === 'pre_workout'
        ? 'Mais carboidrato e pouca gordura para treinar bem'
        : (type === 'post_workout'
          ? 'Refeição de recuperação com proteína e carboidrato'
          : 'Refeição estruturada KRONIA')
    };
  });
}

function normalizeWeights(values) {
  var total = sum(values);
  return values.map(function(value) {
    return total > 0 ? Number(value || 0) / total : 0;
  });
}

function distributeAmount(total, weights, decimals) {
  var scale = Math.pow(10, typeof decimals === 'number' ? decimals : 1);
  var rawUnits = Math.round(Number(total || 0) * scale);
  var normalized = normalizeWeights(weights);
  var portions = normalized.map(function(weight) {
    return Math.floor(rawUnits * weight);
  });
  var used = sum(portions);
  var remainder = rawUnits - used;
  var index = 0;
  while (remainder > 0) {
    portions[index % portions.length] += 1;
    remainder -= 1;
    index += 1;
  }
  return portions.map(function(value) {
    return value / scale;
  });
}

function getMacroWeights(mealTypes, objective) {
  var carbBias = (OBJECTIVE_CONFIG[objective] || OBJECTIVE_CONFIG.manutencao).carbBias;
  var proteinBase = {
    breakfast: 1.0,
    morning_snack: 0.85,
    lunch: 1.1,
    pre_workout: 0.95,
    post_workout: 1.1,
    dinner: 1.05,
    supper: 0.8
  };
  var carbBase = {
    low: {
      breakfast: 0.95,
      morning_snack: 0.7,
      lunch: 1.15,
      pre_workout: 1.25,
      post_workout: 1.35,
      dinner: 1.0,
      supper: 0.45
    },
    moderate: {
      breakfast: 1.0,
      morning_snack: 0.75,
      lunch: 1.1,
      pre_workout: 1.25,
      post_workout: 1.3,
      dinner: 0.95,
      supper: 0.4
    },
    high: {
      breakfast: 1.05,
      morning_snack: 0.8,
      lunch: 1.1,
      pre_workout: 1.2,
      post_workout: 1.35,
      dinner: 0.9,
      supper: 0.35
    }
  };
  var fatBase = {
    breakfast: 1.15,
    morning_snack: 0.9,
    lunch: 1.15,
    pre_workout: 0.35,
    post_workout: 0.4,
    dinner: 1.0,
    supper: 1.05
  };

  return {
    protein: mealTypes.map(function(type) { return proteinBase[type] || 1; }),
    carbs: mealTypes.map(function(type) { return (carbBase[carbBias] || carbBase.moderate)[type] || 1; }),
    fat: mealTypes.map(function(type) { return fatBase[type] || 1; })
  };
}

function buildMealTargets(profile, calc) {
  var blueprints = getMealBlueprints(profile.refeicoesPorDia, profile.horarioTreino);
  var mealTypes = blueprints.map(function(blueprint) { return blueprint.type; });
  var weights = getMacroWeights(mealTypes, profile.objetivo);
  var proteins = distributeAmount(calc.macros.protein, weights.protein, 1);
  var carbs = distributeAmount(calc.macros.carbs, weights.carbs, 1);
  var fats = distributeAmount(calc.macros.fat, weights.fat, 1);

  return blueprints.map(function(blueprint, index) {
    return {
      ordem: index + 1,
      tipo: blueprint.type,
      nome: blueprint.nome,
      horario: blueprint.horario,
      tag: blueprint.tag,
      meta: {
        protein: proteins[index],
        carbs: carbs[index],
        fat: fats[index],
        calories: round((proteins[index] * 4) + (carbs[index] * 4) + (fats[index] * 9))
      }
    };
  });
}

function calculateItemsSubtotal(items) {
  return {
    kcal: round(sum(items, function(item) { return item.calorias; }), 1),
    protein: round(sum(items, function(item) { return item.proteinas; }), 1),
    carbs: round(sum(items, function(item) { return item.carboidratos; }), 1),
    fat: round(sum(items, function(item) { return item.gorduras; }), 1),
    fiber: round(sum(items, function(item) { return item.fibras; }), 1)
  };
}

function addSubstitutions(items, profile) {
  return items.map(function(item, index) {
    var source = FOOD_CATALOG.find(function(food) { return food.code === item.foodCode; });
    var codes = source ? (SUBSTITUTION_GROUPS[source.subGroup] || []) : [];
    var substitutions = getFoodsByCodes(codes, profile)
      .filter(function(food) { return food.code !== item.foodCode; })
      .slice(0, 2)
      .map(function(food) {
        var scaled = scaleFood(food, 1);
        return {
          foodCode: food.code,
          nome: food.name,
          porcao: food.portionLabel,
          calorias: round(scaled.calorias, 1),
          proteinas: round(scaled.proteinas, 1),
          carboidratos: round(scaled.carboidratos, 1),
          gorduras: round(scaled.gorduras, 1)
        };
      });

    return Object.assign({}, item, {
      ordem: index + 1,
      substituicoes: substitutions
    });
  });
}

function buildBreakfastItems(target, profile) {
  var items = [];
  var isVegan = /vegano|vegan/.test(normalizeFreeText((profile.restricoesAlimentares || []).join(' ')));
  var proteinPowder = selectFood(isVegan ? ['proteina_veg'] : ['whey', 'proteina_veg'], profile, isVegan ? 'proteina_veg' : 'whey');
  var eggs = !isVegan ? selectFood(['ovo'], profile, 'ovo') : null;
  var tofu = isVegan ? selectFood(['tofu'], profile, 'tofu') : null;
  var oats = selectFood(['aveia'], profile, 'aveia');
  var banana = selectFood(['banana'], profile, 'banana');
  var bread = selectFood(['pao'], profile, 'pao');
  var fatFood = selectFood(['pasta_amendoim', 'abacate'], profile, 'pasta_amendoim');

  var baseProtein = eggs ? 2 : (tofu ? 15 : 0);
  addScaledItem(items, eggs, eggs ? 2 : 0);
  addScaledItem(items, tofu, tofu ? Math.max(12, round((target.protein * 0.35) / 0.8)) : 0);

  var remainingProtein = Math.max(0, target.protein - calculateItemsSubtotal(items).protein);
  addScaledItem(items, proteinPowder, remainingProtein > 0 ? round(remainingProtein / proteinPowder.protein, 1) : 0);

  var carbFromBanana = target.carbs >= 20 ? Math.max(8, Math.min(12, round((target.carbs * 0.3) / banana.carbs))) : 0;
  addScaledItem(items, banana, carbFromBanana);

  var carbsLeft = Math.max(0, target.carbs - calculateItemsSubtotal(items).carbs);
  if (carbsLeft > 18 && bread) {
    addScaledItem(items, bread, round((carbsLeft * 0.35) / bread.carbs, 1));
  }

  carbsLeft = Math.max(0, target.carbs - calculateItemsSubtotal(items).carbs);
  addScaledItem(items, oats, carbsLeft > 0 ? round(carbsLeft / oats.carbs, 1) : 0);

  var fatsLeft = Math.max(0, target.fat - calculateItemsSubtotal(items).fat);
  addScaledItem(items, fatFood, fatsLeft > 0.3 ? round(fatsLeft / fatFood.fat, 1) : 0);

  return items;
}

function buildSnackItems(target, profile, mealType) {
  var items = [];
  var isVegan = /vegano|vegan/.test(normalizeFreeText((profile.restricoesAlimentares || []).join(' ')));
  var proteinFood = selectFood(
    isVegan ? ['proteina_veg', 'tofu'] : ['iogurte', 'whey', 'proteina_veg'],
    profile,
    isVegan ? 'proteina_veg' : 'iogurte'
  );
  var carbFood = selectFood(['banana', 'aveia', 'pao'], profile, 'banana');
  var fatFood = selectFood(['castanhas', 'pasta_amendoim', 'abacate'], profile, 'castanhas');

  addScaledItem(items, proteinFood, target.protein > 0 ? round(target.protein / proteinFood.protein, 1) : 0);

  var carbsLeft = Math.max(0, target.carbs - calculateItemsSubtotal(items).carbs);
  addScaledItem(items, carbFood, carbsLeft > 0 ? round(carbsLeft / carbFood.carbs, 1) : 0);

  if (mealType !== 'pre_workout') {
    var fatsLeft = Math.max(0, target.fat - calculateItemsSubtotal(items).fat);
    addScaledItem(items, fatFood, fatsLeft > 0.3 ? round(fatsLeft / fatFood.fat, 1) : 0);
  }

  return items;
}

function buildMainMealItems(target, profile, mealType) {
  var items = [];
  var isVegan = /vegano|vegan/.test(normalizeFreeText((profile.restricoesAlimentares || []).join(' ')));
  var proteinOptions = mealType === 'post_workout'
    ? (isVegan ? ['tofu', 'proteina_veg'] : ['frango', 'atum', 'patinho'])
    : (isVegan ? ['tofu', 'proteina_veg'] : ['frango', 'patinho', 'atum']);
  var proteinFood = selectFood(proteinOptions, profile, isVegan ? 'tofu' : 'frango');
  var carbFood = selectFood(mealType === 'post_workout' ? ['arroz', 'batata_doce'] : ['arroz', 'batata_doce', 'feijao'], profile, 'arroz');
  var carbSupport = mealType === 'post_workout' ? null : selectFood(['feijao'], profile, 'feijao');
  var veggie = selectFood(['brocolis', 'salada'], profile, 'brocolis');
  var fatFood = selectFood(['azeite', 'abacate'], profile, 'azeite');

  addScaledItem(items, proteinFood, target.protein > 0 ? round(target.protein / proteinFood.protein, 1) : 0);
  if (carbSupport && mealType !== 'pre_workout' && target.carbs >= 30) {
    addScaledItem(items, carbSupport, 8);
  }

  var carbsLeft = Math.max(0, target.carbs - calculateItemsSubtotal(items).carbs);
  addScaledItem(items, carbFood, carbsLeft > 0 ? round(carbsLeft / carbFood.carbs, 1) : 0);
  addScaledItem(items, veggie, 10);

  var fatsLeft = Math.max(0, target.fat - calculateItemsSubtotal(items).fat);
  if (mealType === 'post_workout') fatsLeft = Math.min(fatsLeft, 8);
  addScaledItem(items, fatFood, fatsLeft > 0.3 ? round(fatsLeft / fatFood.fat, 1) : 0);

  return items;
}

function rebalanceMealItems(items, target, mealType, profile) {
  var rebalanced = items.slice();
  var subtotal = calculateItemsSubtotal(rebalanced);
  var proteinGap = round(target.protein - subtotal.protein, 1);
  var carbGap = round(target.carbs - subtotal.carbs, 1);
  var fatGap = round(target.fat - subtotal.fat, 1);

  if (proteinGap > 0.2) {
    addScaledItem(rebalanced, selectFood(['whey', 'proteina_veg', 'frango'], profile, 'whey'), round(proteinGap / 8, 1));
  }
  if (carbGap > 0.2) {
    var carbFixFood = mealType === 'breakfast'
      ? selectFood(['aveia', 'banana', 'pao'], profile, 'aveia')
      : selectFood(['arroz', 'banana', 'batata_doce'], profile, 'arroz');
    addScaledItem(rebalanced, carbFixFood, round(carbGap / carbFixFood.carbs, 1));
  }
  if (fatGap > 0.2) {
    var fatFixFood = mealType === 'pre_workout'
      ? selectFood(['abacate'], profile, 'abacate')
      : selectFood(['azeite', 'castanhas', 'pasta_amendoim'], profile, 'azeite');
    addScaledItem(rebalanced, fatFixFood, round(fatGap / fatFixFood.fat, 1));
  }

  return rebalanced;
}

function buildMealItems(meal, profile) {
  var items;
  if (meal.tipo === 'breakfast') items = buildBreakfastItems(meal.meta, profile);
  else if (meal.tipo === 'morning_snack' || meal.tipo === 'supper' || meal.tipo === 'pre_workout') items = buildSnackItems(meal.meta, profile, meal.tipo);
  else items = buildMainMealItems(meal.meta, profile, meal.tipo);

  return rebalanceMealItems(items, meal.meta, meal.tipo, profile);
}

function buildInitialNutritionPlan(profile, calc) {
  var mealTargets = buildMealTargets(profile, calc);
  var meals = mealTargets.map(function(meal) {
    var items = addSubstitutions(buildMealItems(meal, profile), profile);
    var subtotal = calculateItemsSubtotal(items);
    return {
      ordem: meal.ordem,
      tipo: meal.tipo,
      nome: meal.nome,
      horario: meal.horario,
      tag: meal.tag,
      meta: {
        calories: subtotal.kcal,
        protein: subtotal.protein,
        carbs: subtotal.carbs,
        fat: subtotal.fat
      },
      subtotal: subtotal,
      itens: items
    };
  });

  var daySummary = {
    calories: round(sum(meals, function(meal) { return meal.subtotal.kcal; }), 1),
    protein: round(sum(meals, function(meal) { return meal.subtotal.protein; }), 1),
    carbs: round(sum(meals, function(meal) { return meal.subtotal.carbs; }), 1),
    fat: round(sum(meals, function(meal) { return meal.subtotal.fat; }), 1)
  };

  return {
    objetivo: profile.objetivo,
    caloriasMeta: daySummary.calories,
    macrosMeta: {
      protein: daySummary.protein,
      carbs: daySummary.carbs,
      fat: daySummary.fat
    },
    refeicoesPorDia: profile.refeicoesPorDia,
    refeicoes: meals,
    resumoDiario: daySummary
  };
}

function limitedOrientation(profile, validation) {
  return {
    limited: true,
    reason: 'Dados insuficientes ou inconsistentes para plano completo.',
    inconsistencias: validation.errors,
    orientacao: 'Complete sexo, idade, peso e altura válidos. Em casos clínicos, gestação, sintomas gastrointestinais ou uso de medicação, procure um nutricionista para individualização.',
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
      macros: 'Proteína 1,6-2,2 g/kg, gordura 0,6-1,0 g/kg e carboidrato preenchendo o restante das calorias'
    },
    result: {
      tmb: bmr,
      get: get,
      targetCalories: macros.calories,
      macros: {
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
      },
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
    calculation: {
      tmb: calc.result.tmb,
      get: calc.result.get,
      targetCalories: plan.resumoDiario.calories,
      macros: {
        protein: plan.resumoDiario.protein,
        carbs: plan.resumoDiario.carbs,
        fat: plan.resumoDiario.fat
      },
      activityFactor: calc.result.activityFactor,
      objective: calc.result.objective
    },
    plan: plan,
    clinicalSafety: 'Plano automatizado para rotina esportiva geral. Não substitui acompanhamento clínico em contextos terapêuticos.'
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
