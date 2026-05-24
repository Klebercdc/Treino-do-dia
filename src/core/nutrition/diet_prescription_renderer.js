'use strict';

var premiumCatalog = require('../../lib/nutrition/premiumCatalog');
var visualPrescription = require('../../lib/nutrition/visualPrescription');
var clinical = require('./diet_context_clinical');
var strategyEngine = require('./diet_strategy_engine');
var dietTemplates = require('../diet/dietTemplates');

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
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

var MEAL_TEMPLATES = {
  3: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.28, carbShare: 0.24, fatShare: 0.28 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.37, carbShare: 0.36, fatShare: 0.36 },
    { tipo: 'jantar', nome: 'Jantar', horario: '20:00', proteinShare: 0.35, carbShare: 0.40, fatShare: 0.36 }
  ],
  4: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.24, carbShare: 0.22, fatShare: 0.24 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.31, carbShare: 0.31, fatShare: 0.30 },
    { tipo: 'lanche_tarde', nome: 'Café da tarde', horario: '16:00', proteinShare: 0.16, carbShare: 0.17, fatShare: 0.12 },
    { tipo: 'jantar', nome: 'Jantar', horario: '19:30', proteinShare: 0.29, carbShare: 0.30, fatShare: 0.34 }
  ],
  5: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.21, carbShare: 0.18, fatShare: 0.22 },
    { tipo: 'lanche_manha', nome: 'Lanche da manhã', horario: '10:00', proteinShare: 0.12, carbShare: 0.11, fatShare: 0.11 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.27, carbShare: 0.27, fatShare: 0.25 },
    { tipo: 'lanche_tarde', nome: 'Café da tarde', horario: '16:00', proteinShare: 0.14, carbShare: 0.16, fatShare: 0.10 },
    { tipo: 'jantar', nome: 'Jantar', horario: '19:30', proteinShare: 0.26, carbShare: 0.28, fatShare: 0.32 }
  ],
  6: [
    { tipo: 'cafe_da_manha', nome: 'Café da manhã', horario: '07:00', proteinShare: 0.19, carbShare: 0.15, fatShare: 0.18 },
    { tipo: 'lanche_manha', nome: 'Lanche da manhã', horario: '09:45', proteinShare: 0.10, carbShare: 0.10, fatShare: 0.10 },
    { tipo: 'almoco', nome: 'Almoço', horario: '12:30', proteinShare: 0.24, carbShare: 0.24, fatShare: 0.22 },
    { tipo: 'lanche_tarde', nome: 'Café da tarde', horario: '16:00', proteinShare: 0.12, carbShare: 0.14, fatShare: 0.09 },
    { tipo: 'jantar', nome: 'Jantar', horario: '19:30', proteinShare: 0.24, carbShare: 0.25, fatShare: 0.26 },
    { tipo: 'ceia', nome: 'Ceia', horario: '22:00', proteinShare: 0.11, carbShare: 0.12, fatShare: 0.15 }
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
    { code: 'granola_30', name: 'Granola', portionLabel: '30 g', grams: 30, calories: 128, protein: 3, carbs: 20, fat: 4, fiber: 2.5, source: 'USDA FoodData Central (adaptado)' },
    { code: 'tapioca_70', name: 'Tapioca', portionLabel: '70 g', grams: 70, calories: 168, protein: 0.3, carbs: 42, fat: 0, fiber: 0.2, source: 'TACO (adaptado)' }
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
    { code: 'mel_20', name: 'Mel', portionLabel: '20 g', grams: 20, calories: 61, protein: 0, carbs: 17, fat: 0, fiber: 0, source: 'USDA FoodData Central (adaptado)' },
    { code: 'uva_100', name: 'Uva', portionLabel: '100 g', grams: 100, calories: 68, protein: 0.6, carbs: 17, fat: 0.2, fiber: 0.9, source: 'TACO/USDA (adaptado)' }
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
    { code: 'legumes_100', name: 'Legumes cozidos', portionLabel: '100 g', grams: 100, calories: 35, protein: 1.5, carbs: 7, fat: 0.3, fiber: 2.8, source: 'TACO/USDA (adaptado)' },
    { code: 'cenoura_100', name: 'Cenoura cozida', portionLabel: '100 g', grams: 100, calories: 35, protein: 0.8, carbs: 8.2, fat: 0.2, fiber: 2.9, source: 'TACO (adaptado)' }
  ]
};

FOOD_LIBRARY = premiumCatalog.buildPremiumFoodLibrary();

function isRestricted(food, restrictions, dislikes) {
  var text = normalizeFreeText((restrictions || []).join(' '));
  var name = normalizeFreeText(food.name);
  var subgroup = normalizeFreeText(food.subgroupKey || '');
  var group = normalizeFreeText(food.groupKey || '');
  if (/vegetarian|vegetariano/.test(text) && group === 'proteinas' && !/ovos|laticinios|proteinas_vegetais|suplementos/.test(subgroup)) return true;
  if (/vegano|vegan/.test(text) && (group === 'laticinios' || (group === 'proteinas' && !/proteinas_vegetais/.test(subgroup)))) return true;
  if (/vegetarian|vegetariano/.test(text) && /frango|patinho|tilapia|atum|salmao|sardinha|camarao|lula|mexilhao|suino|peru|pescada|merluza|linguado|cavalinha/.test(name)) return true;
  if (/vegano|vegan/.test(text) && /frango|patinho|tilapia|ovo|iogurte|whey|mel|queijo|leite|cottage|skyr|caseina|atum|salmao|sardinha|camarao|lula|mexilhao|suino|peru|pescada|merluza|linguado|cavalinha/.test(name)) return true;
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
    groupKey: item.groupKey || null,
    subgroupKey: item.subgroupKey || null,
    tags: item.tags || [],
    substituicoes: item.substituicoes || []
  };
}

function selectDistinctFood(listName, profile, index, excludedNames) {
  var excluded = (excludedNames || []).map(normalizeFreeText).filter(Boolean);
  var pool = (FOOD_LIBRARY[listName] || []).filter(function(food) {
    if (isRestricted(food, profile.restricoesAlimentares, profile.alimentosEvitar)) return false;
    if (clinical.shouldAvoidFoodForClinical(food, profile)) return false;
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

    if (process.env.NODE_ENV === 'development' && pass === 0 && (Math.abs(proteinGap) > 2 || Math.abs(carbGap) > 4 || Math.abs(fatGap) > 1.5)) {
      console.log('[NUTRITION_VALIDATION] Rebalance needed — protein gap:', proteinGap, '| carb gap:', carbGap, '| fat gap:', fatGap);
    }

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
    return !isRestricted(food, profile.restricoesAlimentares, profile.alimentosEvitar) && !clinical.shouldAvoidFoodForClinical(food, profile);
  });
  if (!items.length) items = FOOD_LIBRARY[listName] || [];
  items = items.slice().sort(function(a, b) {
    var aPref = textIncludesAny(a.name, profile.preferencias) ? 1 : 0;
    var bPref = textIncludesAny(b.name, profile.preferencias) ? 1 : 0;
    var aPlant = isPlantProtein(a) ? 1 : 0;
    var bPlant = isPlantProtein(b) ? 1 : 0;
    var aPenalty = clinical.getClinicalPenalty(a, profile);
    var bPenalty = clinical.getClinicalPenalty(b, profile);
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
    if (!isVeganProfile(profile) && !isVegetarianProfile(profile)) {
      if (aPlant !== bPlant) return aPlant - bPlant;
    }
    return (bPref - aPref) || (bPlant - aPlant);
  });
  if (!isVeganProfile(profile) && !isVegetarianProfile(profile) && isProteinList(listName) && !textIncludesAny('tofu', profile.preferencias)) {
    var animalFirst = items.filter(function(food) { return !isPlantProtein(food); });
    if (animalFirst.length) items = animalFirst;
  }
  var rotationWindow = isProteinList(listName) ? Math.min(items.length, 2) : items.length;
  return items[fallbackIndex % Math.max(rotationWindow, 1)] || null;
}

function selectFoodByPattern(listName, profile, patterns, fallbackIndex, excludedNames) {
  var excluded = (excludedNames || []).map(normalizeFreeText).filter(Boolean);
  var tests = (patterns || []).map(function(pattern) {
    return pattern instanceof RegExp ? pattern : new RegExp(String(pattern || ''), 'i');
  });
  var baseItems = (FOOD_LIBRARY[listName] || []).filter(function(food) {
    return !isRestricted(food, profile.restricoesAlimentares, profile.alimentosEvitar)
      && !clinical.shouldAvoidFoodForClinical(food, profile)
      && excluded.indexOf(normalizeFreeText(food.name)) === -1;
  });
  var candidates = tests.length
    ? baseItems.filter(function(food) {
        return tests.some(function(test) { return test.test(normalizeFreeText(food.name)); });
      })
    : baseItems;
  if (candidates.length > 1 && tests.length) {
    candidates = candidates.slice().sort(function(a, b) {
      var aName = normalizeFreeText(a.name);
      var bName = normalizeFreeText(b.name);
      var aScore = tests.findIndex(function(test) { return test.test(aName); });
      var bScore = tests.findIndex(function(test) { return test.test(bName); });
      return aScore - bScore;
    });
  }
  if (!candidates.length) candidates = baseItems;
  if (!candidates.length) return chooseFood(listName, profile, fallbackIndex || 0);
  return candidates[(fallbackIndex || 0) % candidates.length] || null;
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
    source: food.source,
    groupKey: food.groupKey || null,
    subgroupKey: food.subgroupKey || null,
    tags: food.tags || []
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
  var sourceGroup = item.groupKey || null;
  return all
    .filter(function(candidate) {
      if (sourceGroup && candidate.groupKey && candidate.groupKey !== sourceGroup) return false;
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

function buildMealItems(template, profile, macros, index, aiStrategy) {
  var mealIntent = aiStrategy && aiStrategy.mealIntentions && aiStrategy.mealIntentions[template.tipo];

  if (process.env.NODE_ENV === 'development' && mealIntent) {
    console.log('[AI_FOOD_INTENT]', template.tipo + ':', mealIntent.description || JSON.stringify(mealIntent));
  }

  var isPreworkout = !!(mealIntent && mealIntent.preworkout);
  var isPostworkout = !!(mealIntent && mealIntent.postworkout);
  var avoidFat = !!(mealIntent && mealIntent.avoidFat);
  var carbFocus = mealIntent ? String(mealIntent.carbFocus || '') : '';
  var proteinFocusHigh = !!(mealIntent && mealIntent.proteinFocus === 'alto');
  var weightPesado = !!(mealIntent && mealIntent.weight === 'pesado');
  var weightLeve = !!(mealIntent && mealIntent.weight === 'leve');

  var proteinSource;
  var supportCarb;
  var fatSource;
  var veggieSource;
  var milkSource;
  var breadSource;
  var oatsSource;
  var breakfastFruit;
  var beanSource = selectFoodByPattern('mealCarbs', profile, [/feij/], index);
  var riceSource = selectFoodByPattern('mealCarbs', profile, [/arroz/], index);
  var saladSource = selectFoodByPattern('veggies', profile, [/salada|folhas|repolho|pepino/], index);

  var isMainMeal = /almoco|jantar/.test(template.tipo) || (weightPesado && !weightLeve);
  var isBreakfast = template.tipo === 'cafe_da_manha';
  var isSnack = /lanche|ceia/.test(template.tipo) || (weightLeve && !isBreakfast);
  var isWorkoutMeal = isPreworkout || isPostworkout;

  if (isPreworkout && !isMainMeal) {
    proteinSource = selectFoodByPattern('fastProteins', profile, [/whey|iogurte/], index);
    breakfastFruit = selectFoodByPattern('fastCarbs', profile, [/banana|granola/], index);
    if (carbFocus === 'complexo') {
      oatsSource = selectFoodByPattern('breakfastCarbs', profile, [/aveia/], index);
    }
  } else if (isBreakfast || isSnack) {
    proteinSource = selectFoodByPattern(isBreakfast ? 'breakfastProteins' : 'fastProteins', profile, [/ovo/, /leite/, /iogurte/, /tofu/, /whey/], index);
    breadSource = selectFoodByPattern(isBreakfast ? 'breakfastCarbs' : 'fastCarbs', profile, [/pao|pão|tapioca/], index);
    oatsSource = selectFoodByPattern(isBreakfast ? 'breakfastCarbs' : 'fastCarbs', profile, [/aveia|granola/], index);
    breakfastFruit = selectFoodByPattern('supportCarbs', profile, [/banana/, /maca|maçã/, /fruta/], index);
    milkSource = selectFoodByPattern('fastProteins', profile, [/leite/, /iogurte/, /bebida vegetal/], index);
  } else {
    proteinSource = selectFoodByPattern('mealProteins', profile, [/frango|patinho|tilapia|tofu|sardinha|peixe/], index);
    veggieSource = selectFoodByPattern('veggies', profile, [/legume|brocol|brócol|cenoura|abobrinha|chuchu|abobora|abóbora|couve/], index);
    if (!avoidFat) {
      fatSource = selectFoodByPattern('fats', profile, [/azeite/], index);
    }
  }

  supportCarb = selectFoodByPattern('supportCarbs', profile, [/banana|maca|maçã|fruta/], index);

  var proteinScaleMod = proteinFocusHigh ? 1.12 : 1.0;

  var items = [];
  if (isMainMeal) {
    if (proteinSource) items.push(cloneFoodItem(proteinSource, Math.max(0.95, Math.min(1.55, (macros.protein / Math.max(proteinSource.protein, 1)) * proteinScaleMod))));

    if (carbFocus === 'pre_treino' || carbFocus === 'simples') {
      if (riceSource) items.push(cloneFoodItem(riceSource, Math.max(0.7, Math.min(1.3, (macros.carbs * 0.45) / Math.max(riceSource.carbs, 1)))));
    } else {
      if (riceSource) items.push(cloneFoodItem(riceSource, Math.max(0.9, Math.min(1.7, (macros.carbs * 0.56) / Math.max(riceSource.carbs, 1)))));
      if (beanSource) items.push(cloneFoodItem(beanSource, Math.max(0.8, Math.min(1.5, (macros.carbs * 0.24) / Math.max(beanSource.carbs, 1)))));
    }

    if (veggieSource) items.push(cloneFoodItem(veggieSource, 1.2));
    if (saladSource) items.push(cloneFoodItem(saladSource, 1));
    if (!avoidFat && fatSource && macros.fat > 2) items.push(cloneFoodItem(fatSource, Math.max(0.5, Math.min(1.25, macros.fat / Math.max(fatSource.fat, 1)))));
  } else if (isPreworkout && !isMainMeal) {
    if (proteinSource) items.push(cloneFoodItem(proteinSource, Math.max(0.6, Math.min(1.1, (macros.protein * 0.75) / Math.max(proteinSource.protein, 1)))));
    if (breakfastFruit) items.push(cloneFoodItem(breakfastFruit, Math.max(0.7, Math.min(1.5, (macros.carbs * 0.55) / Math.max(breakfastFruit.carbs, 1)))));
    if (oatsSource) items.push(cloneFoodItem(oatsSource, Math.max(0.5, Math.min(1.0, (macros.carbs * 0.30) / Math.max(oatsSource.carbs, 1)))));
  } else {
    if (proteinSource) items.push(cloneFoodItem(proteinSource, Math.max(isSnack ? 0.7 : 0.9, Math.min(1.4, ((macros.protein * (isSnack ? 0.7 : 0.85)) / Math.max(proteinSource.protein, 1)) * proteinScaleMod))));

    if (carbFocus === 'pre_treino') {
      if (breakfastFruit) items.push(cloneFoodItem(breakfastFruit, Math.max(0.8, Math.min(1.5, (macros.carbs * 0.5) / Math.max(breakfastFruit.carbs, 1)))));
    } else {
      if (breadSource) items.push(cloneFoodItem(breadSource, Math.max(0.7, Math.min(1.35, (macros.carbs * 0.35) / Math.max(breadSource.carbs, 1)))));
      if (milkSource && (!proteinSource || milkSource.code !== proteinSource.code)) items.push(cloneFoodItem(milkSource, Math.max(0.7, Math.min(1.2, (macros.protein * 0.25) / Math.max(milkSource.protein || 1, 1)))));
      if (breakfastFruit) items.push(cloneFoodItem(breakfastFruit, Math.max(0.65, Math.min(1.1, (macros.carbs * 0.22) / Math.max(breakfastFruit.carbs, 1)))));
      if (oatsSource && (!breadSource || oatsSource.code !== breadSource.code)) items.push(cloneFoodItem(oatsSource, Math.max(0.55, Math.min(1.0, (macros.carbs * 0.25) / Math.max(oatsSource.carbs, 1)))));
    }

    if (!isBreakfast && !isPreworkout && supportCarb && (!breakfastFruit || supportCarb.code !== breakfastFruit.code) && macros.carbs > 24) {
      items.push(cloneFoodItem(supportCarb, Math.max(0.4, Math.min(0.8, (macros.carbs * 0.12) / Math.max(supportCarb.carbs, 1)))));
    }
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
    var extraProtein = selectFoodByPattern(isMainMeal ? 'mealProteins' : 'fastProteins', profile, isMainMeal ? [/frango|patinho|tilapia|tofu|sardinha|peixe/] : [/ovo|iogurte|leite|tofu|whey/], 0)
      || chooseFood('breakfastProteins', profile, 0);
    if (extraProtein) items.push(Object.assign({}, cloneFoodItem(extraProtein, Math.max(0.4, proteinGap / Math.max(extraProtein.protein, 1))), {
      substituicoes: buildSubstitutions(cloneFoodItem(extraProtein, 1), profile)
    }));
  }
  if (carbGap > 8 && !isMainMeal) {
    var existingNames = items.map(function(item) { return item.nome; });
    var extraCarb = isBreakfast
      ? (selectFoodByPattern('breakfastCarbs', profile, [/pao|pão|aveia|banana/], 0, existingNames) || selectDistinctFood('supportCarbs', profile, 0, existingNames))
      : (selectFoodByPattern('fastCarbs', profile, [/pao|pão|aveia|banana|fruta/], 0, existingNames) || selectDistinctFood('supportCarbs', profile, 0, existingNames));
    if (extraCarb) items.push(Object.assign({}, cloneFoodItem(extraCarb, Math.max(0.5, carbGap / Math.max(extraCarb.carbs, 1))), {
      substituicoes: buildSubstitutions(cloneFoodItem(extraCarb, 1), profile)
    }));
  }

  return rebalanceMealItems(items, macros, { isWorkoutMeal: isWorkoutMeal });
}

function getMealTemplates(profile, selectedTemplate) {
  var requestedCount = Math.min(6, Math.max(3, Number(profile.refeicoesPorDia || 5)));
  var templateMatchesRequested = selectedTemplate && Number(selectedTemplate.quantidade_refeicoes) === requestedCount;
  var templates = templateMatchesRequested && Array.isArray(selectedTemplate.estrutura_refeicoes) && selectedTemplate.estrutura_refeicoes.length
    ? selectedTemplate.estrutura_refeicoes
    : (MEAL_TEMPLATES[requestedCount] || MEAL_TEMPLATES[5]);
  if (profile.nivelAtividade !== 'sedentario') return templates;

  return templates.map(function(template) {
    if (template.tipo === 'lanche_tarde') {
      return Object.assign({}, template, {
        nome: 'Lanche da tarde'
      });
    }
    if (template.tipo === 'lanche_pre_treino') {
      return Object.assign({}, template, {
        tipo: 'lanche_tarde',
        nome: 'Lanche da tarde'
      });
    }
    if (template.tipo === 'jantar_pos_treino') {
      return Object.assign({}, template, {
        tipo: 'jantar',
        nome: 'Jantar'
      });
    }
    return template;
  });
}

function validateAIMacroDistribution(aiDist, templates) {
  if (!aiDist || typeof aiDist !== 'object') return false;
  var proteinSum = 0;
  var carbSum = 0;
  var fatSum = 0;
  for (var i = 0; i < templates.length; i++) {
    var dist = aiDist[templates[i].tipo];
    if (!dist) return false;
    var ps = Number(dist.proteinShare);
    var cs = Number(dist.carbShare);
    var fs = Number(dist.fatShare);
    if (!Number.isFinite(ps) || !Number.isFinite(cs) || !Number.isFinite(fs)) return false;
    proteinSum += ps;
    carbSum += cs;
    fatSum += fs;
  }
  var tol = 0.10;
  return Math.abs(proteinSum - 1.0) <= tol && Math.abs(carbSum - 1.0) <= tol && Math.abs(fatSum - 1.0) <= tol;
}

function distributeMacrosAcrossMeals(profile, macros, selectedTemplate, aiStrategy) {
  var templates = getMealTemplates(profile, selectedTemplate);
  var aiDist = aiStrategy && aiStrategy.macroDistribution;
  var useAI = aiDist && validateAIMacroDistribution(aiDist, templates);

  if (process.env.NODE_ENV === 'development') {
    console.log('[AI_MACRO_DISTRIBUTION] Using AI distribution:', useAI);
  }

  return templates.map(function(template, index) {
    var dist = useAI ? (aiDist[template.tipo] || template) : template;
    var ps = Number(dist.proteinShare != null ? dist.proteinShare : template.proteinShare);
    var cs = Number(dist.carbShare != null ? dist.carbShare : template.carbShare);
    var fs = Number(dist.fatShare != null ? dist.fatShare : template.fatShare);
    return {
      ordem: index + 1,
      tipo: template.tipo,
      nome: template.nome,
      horario: template.horario,
      meta: {
        calories: round((macros.protein * ps * 4) + (macros.carbs * cs * 4) + (macros.fat * fs * 9)),
        protein: round(macros.protein * ps, 1),
        carbs: round(macros.carbs * cs, 1),
        fat: round(macros.fat * fs, 1)
      }
    };
  });
}

function buildInitialNutritionPlan(profile, calc, selectedTemplate, aiStrategy) {
  var mealTargets = distributeMacrosAcrossMeals(profile, calc.macros, selectedTemplate, aiStrategy);
  var meals = mealTargets.map(function(target, index) {
    var items = buildMealItems(target, profile, target.meta, index, aiStrategy);
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
    templateId: selectedTemplate ? selectedTemplate.id : null,
    templateName: selectedTemplate ? selectedTemplate.nome : null,
    templateStrategy: selectedTemplate ? selectedTemplate.estrategia_nutricional : null,
    ordemConsumo: selectedTemplate ? selectedTemplate.ordem_consumo : null,
    alertasProfissionais: selectedTemplate ? selectedTemplate.alertas_profissionais : [],
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

function recalculatePlanTotals(plan) {
  var meals = (plan.refeicoes || []).map(function(meal) {
    var subtotal = sumMeal(meal.itens || []);
    return Object.assign({}, meal, {
      subtotal: {
        calorias: round(subtotal.calories),
        proteinas: round(subtotal.protein, 1),
        carboidratos: round(subtotal.carbs, 1),
        gorduras: round(subtotal.fat, 1)
      }
    });
  });
  var totals = meals.reduce(function(acc, meal) {
    acc.calories += meal.subtotal.calorias;
    acc.protein += meal.subtotal.proteinas;
    acc.carbs += meal.subtotal.carboidratos;
    acc.fat += meal.subtotal.gorduras;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return Object.assign({}, plan, {
    caloriasMeta: round(totals.calories),
    macrosMeta: {
      protein: round(totals.protein, 1),
      carbs: round(totals.carbs, 1),
      fat: round(totals.fat, 1)
    },
    resumoDiario: {
      calorias: round(totals.calories),
      proteinas: round(totals.protein, 1),
      carboidratos: round(totals.carbs, 1),
      gorduras: round(totals.fat, 1)
    },
    refeicoes: meals
  });
}

function capPlanCalories(plan, maxCalories) {
  var currentCalories = Number(plan && plan.resumoDiario && plan.resumoDiario.calorias);
  var targetCalories = Number(maxCalories);
  if (!Number.isFinite(currentCalories) || !Number.isFinite(targetCalories) || currentCalories <= targetCalories) {
    return plan;
  }

  var factor = Math.max(0.5, (targetCalories - 1) / currentCalories);
  var scaled = Object.assign({}, plan, {
    refeicoes: (plan.refeicoes || []).map(function(meal) {
      return Object.assign({}, meal, {
        itens: (meal.itens || []).map(function(item) {
          return cloneScaledMealItem(item, factor);
        })
      });
    })
  });
  return recalculatePlanTotals(scaled);
}

/**
 * Builds condition-based clinical notes and adjustment summary from
 * user-selected healthConditions (e.g. Diabetes, Hipertensão).
 * These notes are explicit, mandatory, and appear in every plan that has conditions.
 */
function buildConditionClinicalNotes(profile) {
  var flags = profile.clinicalData && profile.clinicalData.flags ? profile.clinicalData.flags : {};
  var conditions = (profile.clinicalData && profile.clinicalData.healthConditions) || [];
  var notes = [];
  var adjustments = [];

  if (flags.hasDiabetes) {
    notes.push('Diabetes identificada: carboidratos distribuídos ao longo do dia para controlar carga glicêmica. Fontes simples de açúcar e ultraprocessados foram evitados.');
    adjustments.push('Diabetes: controle glicêmico aplicado — distribuição de carboidratos e evitar açúcar simples');
  }
  if (flags.hasHipertensao) {
    notes.push('Hipertensão identificada: plano elaborado com baixo teor de sódio. Ultraprocessados e embutidos foram excluídos das sugestões.');
    adjustments.push('Hipertensão: baixo sódio — evitar ultraprocessados e embutidos');
  }
  if (flags.hasDoencaRenal) {
    notes.push('Doença renal / hemodiálise identificada: abordagem conservadora aplicada. Recomenda-se acompanhamento rigoroso com nefrologista e nutricionista para controle de sódio, potássio, fósforo e proteína.');
    adjustments.push('Doença renal: abordagem conservadora — sódio, potássio, fósforo e proteína controlados com orientação profissional');
  }
  if (flags.hasDislipidemia) {
    notes.push('Dislipidemia identificada: priorizadas fontes proteicas magras e gorduras insaturadas. Gordura saturada reduzida.');
    adjustments.push('Dislipidemia: gordura saturada reduzida, gorduras boas priorizadas');
  }
  if (flags.hasGastriteRefluxo) {
    notes.push('Gastrite/Refluxo identificado: alimentos irritantes como frituras, excesso de café, pimenta e alimentos muito gordurosos foram evitados nas sugestões.');
    adjustments.push('Gastrite/Refluxo: sem irritantes — sem frituras, café excessivo, pimenta');
  }
  if (flags.hasAlergiaIntolerancia) {
    notes.push('Intolerância/Alergia alimentar informada: o alimento indicado é tratado como proibido no plano.');
    adjustments.push('Intolerância/Alergia: alimento informado tratado como proibido');
  }
  if (flags.hasGestacao) {
    notes.push('Gestação identificada: abordagem conservadora aplicada. Recomenda-se acompanhamento com nutricionista ou obstetra para ajustes específicos.');
    adjustments.push('Gestação: abordagem conservadora com recomendação de acompanhamento profissional');
  }
  if (flags.hasPosBariatrica) {
    notes.push('Pós-cirurgia bariátrica identificada: porções menores sugeridas, proteína adequada priorizada e progressão segura recomendada.');
    adjustments.push('Pós-bariátrica: porções menores, proteína adequada e progressão segura');
  }

  var bcmManual = profile.clinicalData && profile.clinicalData.bcmManual;
  if (bcmManual && typeof bcmManual === 'object') {
    notes.push('Composição corporal manual (BCM) utilizada para ajustar estratégia nutricional.');
    adjustments.push('BCM manual: composição corporal usada para refinamento da estratégia');
  }

  var exams = profile.clinicalData && profile.clinicalData.exams;
  if (exams && exams.useExistingExams) {
    notes.push('Exames cadastrados incluídos no contexto clínico.');
    adjustments.push('Exames: dados laboratoriais existentes incluídos no contexto');
  }

  if (conditions.length > 0) {
    notes.push('A dieta não substitui acompanhamento com nutricionista ou médico.');
  }

  return { notes: notes, adjustments: adjustments };
}

/**
 * Generates the mandatory REGRAS CLÍNICAS OBRIGATÓRIAS prompt block
 * based on the user's selected health conditions.
 * This string is attached to the plan so any downstream AI context builder
 * can include it verbatim in the model prompt.
 */
function buildClinicalPromptBlock(profile) {
  var flags = profile.clinicalData && profile.clinicalData.flags ? profile.clinicalData.flags : {};
  var conditions = (profile.clinicalData && profile.clinicalData.healthConditions) || [];

  if (!conditions.length) return null;

  var lines = ['REGRAS CLÍNICAS OBRIGATÓRIAS:'];
  lines.push('Patologias declaradas: ' + conditions.join(', ') + '.');
  lines.push('Sempre considerar clinicalData.healthConditions ao gerar este plano.');

  if (flags.hasDiabetes) lines.push('- Diabetes: controlar açúcar simples, carga glicêmica e distribuir carboidratos ao longo do dia.');
  if (flags.hasHipertensao) lines.push('- Hipertensão: reduzir sódio, evitar ultraprocessados e embutidos.');
  if (flags.hasDoencaRenal) lines.push('- Doença renal ou Hemodiálise: aplicar regra conservadora, controlar sódio, potássio, fósforo e proteína conforme contexto; nunca prometer tratamento.');
  if (flags.hasDislipidemia) lines.push('- Dislipidemia: reduzir gordura saturada e priorizar gorduras boas.');
  if (flags.hasGastriteRefluxo) lines.push('- Gastrite/Refluxo: evitar irritantes como fritura, excesso de café, pimenta e alimentos muito gordurosos.');
  if (flags.hasAlergiaIntolerancia) lines.push('- Intolerância/Alergia alimentar: alimento informado deve ser tratado como proibido.');
  if (flags.hasGestacao) lines.push('- Gestação: usar abordagem conservadora e recomendar acompanhamento profissional.');
  if (flags.hasPosBariatrica) lines.push('- Pós-bariátrica: usar porções menores, proteína adequada e progressão segura.');

  var bcmManual = profile.clinicalData && profile.clinicalData.bcmManual;
  if (bcmManual && typeof bcmManual === 'object') {
    lines.push('- BCM manual disponível: usar composição corporal para ajustar estratégia, sem inventar diagnóstico.');
  }

  var exams = profile.clinicalData && profile.clinicalData.exams;
  if (exams && exams.useExistingExams) {
    lines.push('- Exames cadastrados disponíveis: incluir no contexto clínico.');
  }

  lines.push('- Sempre incluir alerta: "A dieta não substitui acompanhamento com nutricionista ou médico."');

  if (process.env.NODE_ENV === 'development') {
    console.log('[DIET_CLINICAL_PROMPT_CONTEXT]', lines.join('\n'));
  }

  return lines.join('\n');
}

function buildNutritionPrescription(strategy) {
  var calc = strategy;
  if (calc.failSafe) return calc;

  var aiStrategy = calc.profile && calc.profile.aiNutritionStrategy || null;

  if (process.env.NODE_ENV === 'development' && aiStrategy) {
    console.log('[AI_NUTRITION_STRATEGY] Applying strategy to prescription:', aiStrategy.strategyType);
  }

  var selectedTemplate = dietTemplates.selectDietTemplate(calc.profile, calc.result);
  var plan = buildInitialNutritionPlan(calc.profile, calc.result, selectedTemplate, aiStrategy);
  if (clinical.hasCriticalLabFlag(calc.profile)) {
    plan = capPlanCalories(plan, calc.result.targetCalories);
  }

  // Lab-based clinical notes (biomarker flags)
  var clinicalNotes = [];
  if (calc.profile.labContext && calc.profile.labContext.mode === 'clinical') {
    clinicalNotes.push('Plano ajustado com base no seu exame recente.');
    if (clinical.hasClinicalFlag(calc.profile, 'pre_diabetes') || clinical.hasClinicalFlag(calc.profile, 'glycemic_risk')) {
      clinicalNotes.push('Carboidratos distribuídos de forma mais estável ao longo do dia, com menor ênfase em fontes refinadas.');
    }
    if (clinical.hasClinicalFlag(calc.profile, 'high_potassium')) {
      clinicalNotes.push('Foram evitados alimentos com maior carga de potássio, como banana, abacate e batata-doce.');
    }
    if (clinical.hasClinicalFlag(calc.profile, 'high_ldl')) {
      clinicalNotes.push('Foram priorizadas fontes proteicas mais magras e fibras alimentares para um plano mais conservador.');
    }
    if (clinical.hasCriticalLabFlag(calc.profile)) {
      clinicalNotes.push('Valores críticos recentes mantiveram o plano em modo conservador, sem estratégia agressiva de cutting ou bulking.');
    }
  }

  // Condition-based clinical notes (user-selected healthConditions)
  var conditionResult = buildConditionClinicalNotes(calc.profile);
  clinicalNotes = clinicalNotes.concat(conditionResult.notes);
  var visual = visualPrescription.buildVisualPrescription({
    plan: plan,
    calculation: {
      tmb: calc.result.tmb,
      get: calc.result.get,
      targetCalories: plan.resumoDiario.calorias,
      macros: {
        protein: plan.resumoDiario.proteinas,
        carbs: plan.resumoDiario.carboidratos,
        fat: plan.resumoDiario.gorduras
      },
      objective: calc.result.objective
    },
    clinicalNotes: clinicalNotes,
    aiStrategy: aiStrategy
  });
  plan.visualPrescription = visual;
  var templateClinicalAlerts = dietTemplates.clinicalFlags(calc.profile || {}).length
    ? [dietTemplates.CLINICAL_ALERT]
    : [];

  var clinicalPromptBlock = buildClinicalPromptBlock(calc.profile);
  var conditionAdjustments = conditionResult.adjustments;

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
    contextoNutricional: calc.unifiedContext || null,
    estrategiaNutricional: calc.strategy || null,
    plan: plan,
    visualPrescription: visual,
    catalogStats: {
      canonicalFoods: premiumCatalog.CANONICAL_FOODS.length,
      recipes: premiumCatalog.RECIPE_CATALOG.length,
      dietTemplates: dietTemplates.DIET_TEMPLATES.length,
      aliases: premiumCatalog.FOOD_ALIASES.length,
      portions: premiumCatalog.FOOD_PORTIONS.length
    },
    selectedDietTemplate: selectedTemplate,
    recipeSuggestions: premiumCatalog.RECIPE_CATALOG
      .filter(function(recipe) {
        return (plan.refeicoes || []).some(function(meal) { return recipe.meal_slot === meal.tipo; });
      })
      .slice(0, 8),
    clinicalContext: {
      mode: calc.profile.labContext.mode,
      clinicalFlags: calc.profile.labContext.clinicalFlags,
      criticalFlags: calc.profile.labContext.criticalFlags,
      summaryMessage: clinicalNotes[0] || null,
      reportDate: calc.profile.labContext.createdAt || null,
      confidence: calc.profile.labContext.confidence || 0
    },
    clinicalSafety: 'Plano esportivo educacional. Não substitui conduta clínica, terapêutica ou nutricional individualizada em casos complexos.',
    professionalAlerts: (selectedTemplate.alertas_profissionais || []).concat(templateClinicalAlerts),
    clinicalNotes: clinicalNotes,
    ajustesClinicosConsiderados: conditionAdjustments.length
      ? { aplicados: conditionAdjustments, alerta: 'A dieta não substitui acompanhamento com nutricionista ou médico.' }
      : null,
    clinicalPromptBlock: clinicalPromptBlock,
  };
}


function generateNutritionPlan(profileInput) {
  return buildNutritionPrescription(strategyEngine.calculateNutrition(profileInput));
}

function renderPrescription(strategy) {
  return buildNutritionPrescription(strategy);
}

function generatePlan(profileInput) {
  return generateNutritionPlan(profileInput);
}

module.exports = {
  FOOD_LIBRARY: FOOD_LIBRARY,
  MEAL_TEMPLATES: MEAL_TEMPLATES,
  DIET_TEMPLATES: dietTemplates.DIET_TEMPLATES,
  selectDietTemplate: dietTemplates.selectDietTemplate,
  generateDietFromTemplate: dietTemplates.generateDietFromTemplate,
  substituteFood: dietTemplates.substituteFood,
  rebalanceDiet: dietTemplates.rebalanceDiet,
  normalizeDietItem: dietTemplates.normalizeDietItem,
  buildNutritionPrescription: buildNutritionPrescription,
  generateNutritionPlan: generateNutritionPlan,
  renderPrescription: renderPrescription,
  generatePlan: generatePlan
};
