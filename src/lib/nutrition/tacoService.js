'use strict';

const { TACO_DATABASE } = require('./tacoDatabase');

const KRONIA_MACRO_FIELDS = [
  ['energia_kcal', 'kcal_por_100g', 'kcal'],
  ['proteina_g', 'proteina_por_100g', 'proteina'],
  ['carboidrato_g', 'carbo_por_100g', 'carbo'],
  ['lipidios_g', 'gordura_por_100g', 'gordura'],
  ['fibra_g', 'fibra_por_100g', 'fibra'],
  ['sodio_mg', 'sodio_mg_por_100g', 'sodio_mg'],
  ['potassio_mg', 'potassio_mg_por_100g', 'potassio_mg'],
  ['calcio_mg', 'calcio_mg_por_100g', 'calcio_mg'],
  ['ferro_mg', 'ferro_mg_por_100g', 'ferro_mg']
];

function normalizeText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  if (value == null || value === '') return null;
  var number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundValue(value, digits) {
  if (value == null || !Number.isFinite(value)) return null;
  var precision = typeof digits === 'number' ? digits : 4;
  var factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function getAllTacoFoods() {
  return TACO_DATABASE.slice();
}

function getTacoFoodById(tacoId) {
  if (!tacoId) return null;
  var target = String(tacoId);
  return TACO_DATABASE.find(function (food) {
    return food.taco_id === target;
  }) || null;
}

function getTacoFoodByCode(codigoTaco) {
  if (codigoTaco == null || codigoTaco === '') return null;
  var target = Number(codigoTaco);
  if (!Number.isFinite(target)) return null;
  return TACO_DATABASE.find(function (food) {
    return Number(food.codigo_taco) === target;
  }) || null;
}

function buildSearchBlob(food) {
  var parts = [food.nome, food.categoria, food.codigo_taco];
  if (Array.isArray(food.aliases)) parts = parts.concat(food.aliases);
  return normalizeText(parts.filter(Boolean).join(' '));
}

function scoreTacoFood(food, query, normalizedQuery, queryTokens) {
  var name = normalizeText(food.nome);
  var aliasMatches = Array.isArray(food.aliases)
    ? food.aliases.map(normalizeText).filter(Boolean)
    : [];
  var blob = buildSearchBlob(food);
  var score = 0;

  if (!normalizedQuery) return score;

  if (name === normalizedQuery) score += 400;
  if (aliasMatches.indexOf(normalizedQuery) >= 0) score += 450;
  if (blob === normalizedQuery) score += 380;
  if (name.startsWith(normalizedQuery)) score += 120;
  if (blob.startsWith(normalizedQuery)) score += 100;
  if (name.indexOf(normalizedQuery) >= 0) score += 90;
  if (blob.indexOf(normalizedQuery) >= 0) score += 80;

  var matchedTokens = 0;
  for (var i = 0; i < queryTokens.length; i += 1) {
    var token = queryTokens[i];
    if (!token) continue;
    if (blob.indexOf(token) >= 0) matchedTokens += 1;
  }

  if (matchedTokens) score += matchedTokens * 20;
  if (matchedTokens === queryTokens.length && queryTokens.length) score += 40;
  if (normalizeText(food.categoria) === normalizedQuery) score += 25;

  return score;
}

function searchTacoFoods(query, options) {
  var normalizedQuery = normalizeText(query);
  var settings = options || {};
  var limit = typeof settings.limit === 'number' && settings.limit > 0 ? settings.limit : 50;
  var categoryFilter = settings.category ? normalizeText(settings.category) : '';
  var tokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];

  var results = TACO_DATABASE
    .filter(function (food) {
      if (!categoryFilter) return true;
      return normalizeText(food.categoria) === categoryFilter;
    })
    .map(function (food) {
      return {
        food: food,
        score: normalizedQuery ? scoreTacoFood(food, query, normalizedQuery, tokens) : 1
      };
    })
    .filter(function (entry) {
      return normalizedQuery ? entry.score > 0 : true;
    })
    .sort(function (left, right) {
      if (right.score !== left.score) return right.score - left.score;
      return normalizeText(left.food.nome).localeCompare(normalizeText(right.food.nome));
    })
    .slice(0, limit)
    .map(function (entry) {
      return entry.food;
    });

  return results;
}

function getTacoFoodsByCategory(category) {
  var normalizedCategory = normalizeText(category);
  if (!normalizedCategory) return [];
  return TACO_DATABASE.filter(function (food) {
    return normalizeText(food.categoria) === normalizedCategory;
  });
}

function mapTacoFoodToKroniaMacros(food) {
  if (!food) return null;
  var mapped = {
    taco_id: food.taco_id,
    codigo_taco: food.codigo_taco,
    nome: food.nome,
    categoria: food.categoria
  };

  KRONIA_MACRO_FIELDS.forEach(function (pair) {
    var tacoField = pair[0];
    var kroniaField = pair[1];
    mapped[kroniaField] = food[tacoField] == null ? null : Number(food[tacoField]);
  });

  return mapped;
}

function estimateNutritionFromTaco(tacoFood, grams) {
  if (!tacoFood) return null;
  var weight = toNumber(grams);
  if (weight == null) return null;
  var factor = weight / 100;
  var estimated = {
    taco_id: tacoFood.taco_id,
    codigo_taco: tacoFood.codigo_taco,
    nome: tacoFood.nome,
    categoria: tacoFood.categoria,
    grams: weight,
    scaleFactor: roundValue(factor, 6),
    per100g: mapTacoFoodToKroniaMacros(tacoFood)
  };

  KRONIA_MACRO_FIELDS.forEach(function (pair) {
    var tacoField = pair[0];
    var estimatedField = pair[2];
    var base = tacoFood[tacoField];
    if (base == null) {
      if (tacoField === 'energia_kcal') base = tacoFood.kcal_por_100g;
      else if (tacoField === 'proteina_g') base = tacoFood.proteina_por_100g;
      else if (tacoField === 'carboidrato_g') base = tacoFood.carbo_por_100g;
      else if (tacoField === 'lipidios_g') base = tacoFood.gordura_por_100g;
      else if (tacoField === 'fibra_g') base = tacoFood.fibra_por_100g;
      else if (tacoField === 'sodio_mg') base = tacoFood.sodio_mg_por_100g;
      else if (tacoField === 'potassio_mg') base = tacoFood.potassio_mg_por_100g;
      else if (tacoField === 'calcio_mg') base = tacoFood.calcio_mg_por_100g;
      else if (tacoField === 'ferro_mg') base = tacoFood.ferro_mg_por_100g;
    }
    estimated[estimatedField] = base == null ? null : roundValue(Number(base) * factor, 4);
  });

  estimated.energia_kj = tacoFood.energia_kj == null ? null : roundValue(Number(tacoFood.energia_kj) * factor, 4);
  estimated.colesterol_mg = tacoFood.colesterol_mg == null ? null : roundValue(Number(tacoFood.colesterol_mg) * factor, 4);
  estimated.manganes_mg = tacoFood.manganes_mg == null ? null : roundValue(Number(tacoFood.manganes_mg) * factor, 4);
  estimated.fosforo_mg = tacoFood.fosforo_mg == null ? null : roundValue(Number(tacoFood.fosforo_mg) * factor, 4);
  estimated.cobre_mg = tacoFood.cobre_mg == null ? null : roundValue(Number(tacoFood.cobre_mg) * factor, 4);
  estimated.zinco_mg = tacoFood.zinco_mg == null ? null : roundValue(Number(tacoFood.zinco_mg) * factor, 4);
  estimated.retinol_mcg = tacoFood.retinol_mcg == null ? null : roundValue(Number(tacoFood.retinol_mcg) * factor, 4);
  estimated.re_mcg = tacoFood.re_mcg == null ? null : roundValue(Number(tacoFood.re_mcg) * factor, 4);
  estimated.rae_mcg = tacoFood.rae_mcg == null ? null : roundValue(Number(tacoFood.rae_mcg) * factor, 4);
  estimated.tiamina_mg = tacoFood.tiamina_mg == null ? null : roundValue(Number(tacoFood.tiamina_mg) * factor, 4);
  estimated.riboflavina_mg = tacoFood.riboflavina_mg == null ? null : roundValue(Number(tacoFood.riboflavina_mg) * factor, 4);
  estimated.piridoxina_mg = tacoFood.piridoxina_mg == null ? null : roundValue(Number(tacoFood.piridoxina_mg) * factor, 4);
  estimated.niacina_mg = tacoFood.niacina_mg == null ? null : roundValue(Number(tacoFood.niacina_mg) * factor, 4);
  estimated.vitamina_c_mg = tacoFood.vitamina_c_mg == null ? null : roundValue(Number(tacoFood.vitamina_c_mg) * factor, 4);
  var vitaminE = tacoFood.vitamina_e_mg == null ? tacoFood.vitamina_e_mcg : tacoFood.vitamina_e_mg;
  estimated.vitamina_e_mg = vitaminE == null ? null : roundValue(Number(vitaminE) * factor, 4);
  estimated.vitamina_e_mcg = estimated.vitamina_e_mg;

  return estimated;
}

function findBestTacoMatch(foodName) {
  var matches = searchTacoFoods(foodName, { limit: 1 });
  return matches.length ? matches[0] : null;
}

module.exports = {
  TACO_DATABASE: TACO_DATABASE,
  normalizeText: normalizeText,
  getAllTacoFoods: getAllTacoFoods,
  getTacoFoodById: getTacoFoodById,
  getTacoFoodByCode: getTacoFoodByCode,
  searchTacoFoods: searchTacoFoods,
  getTacoFoodsByCategory: getTacoFoodsByCategory,
  mapTacoFoodToKroniaMacros: mapTacoFoodToKroniaMacros,
  estimateNutritionFromTaco: estimateNutritionFromTaco,
  findBestTacoMatch: findBestTacoMatch
};
