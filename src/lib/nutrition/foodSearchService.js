'use strict';

var kronaFoodDatabase = require('./kronaFoodDatabase');
var tacoService = require('./tacoService');

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

function clone(value) {
  return value && typeof value === 'object' ? Object.assign({}, value) : null;
}

function getPremiumFoods() {
  return kronaFoodDatabase.getAllFoods().slice();
}

function buildPremiumSearchBlob(food) {
  var parts = [
    food.nome,
    food.code,
    food.categoria,
    food.subcategoria,
    food.grupo_equivalencia
  ];
  return normalizeText(parts.filter(Boolean).join(' '));
}

function buildTacoSearchBlob(food) {
  var parts = [
    food.nome,
    food.codigo_taco,
    food.categoria,
    Array.isArray(food.aliases) ? food.aliases.join(' ') : ''
  ];
  return normalizeText(parts.filter(Boolean).join(' '));
}

function buildPremiumResult(food) {
  return {
    source: 'kronia',
    is_taco_fallback: false,
    code: food.code || food.slug || null,
    id: food.code || food.slug || null,
    taco_id: food.taco_id || null,
    codigo_taco: food.codigo_taco || null,
    nome: food.nome || null,
    categoria: food.categoria || null,
    grupo_equivalencia: food.grupo_equivalencia || null,
    kcal_por_100g: toNumber(food.kcal_por_100g),
    proteina_por_100g: toNumber(food.proteina_por_100g),
    carbo_por_100g: toNumber(food.carbo_por_100g),
    gordura_por_100g: toNumber(food.gordura_por_100g),
    fibra_por_100g: toNumber(food.fibra_por_100g),
    sodio_mg_por_100g: toNumber(food.sodio_mg_por_100g),
    potassio_mg_por_100g: toNumber(food.potassio_mg_por_100g),
    calcio_mg_por_100g: toNumber(food.calcio_mg_por_100g),
    ferro_mg_por_100g: toNumber(food.ferro_mg_por_100g),
    raw: clone(food)
  };
}

function buildTacoResult(food) {
  var macros = tacoService.mapTacoFoodToKroniaMacros(food);
  return {
    source: 'taco',
    is_taco_fallback: true,
    code: food.taco_id,
    id: food.taco_id,
    taco_id: food.taco_id,
    codigo_taco: food.codigo_taco,
    nome: food.nome,
    categoria: food.categoria || null,
    energia_kcal: toNumber(food.energia_kcal),
    energia_kj: toNumber(food.energia_kj),
    proteina_g: toNumber(food.proteina_g),
    lipidios_g: toNumber(food.lipidios_g),
    carboidrato_g: toNumber(food.carboidrato_g),
    fibra_g: toNumber(food.fibra_g),
    colesterol_mg: toNumber(food.colesterol_mg),
    cinzas_g: toNumber(food.cinzas_g),
    calcio_mg: toNumber(food.calcio_mg),
    magnesio_mg: toNumber(food.magnesio_mg),
    manganes_mg: toNumber(food.manganes_mg),
    fosforo_mg: toNumber(food.fosforo_mg),
    ferro_mg: toNumber(food.ferro_mg),
    sodio_mg: toNumber(food.sodio_mg),
    potassio_mg: toNumber(food.potassio_mg),
    cobre_mg: toNumber(food.cobre_mg),
    zinco_mg: toNumber(food.zinco_mg),
    retinol_mcg: toNumber(food.retinol_mcg),
    re_mcg: toNumber(food.re_mcg),
    rae_mcg: toNumber(food.rae_mcg),
    tiamina_mg: toNumber(food.tiamina_mg),
    riboflavina_mg: toNumber(food.riboflavina_mg),
    piridoxina_mg: toNumber(food.piridoxina_mg),
    niacina_mg: toNumber(food.niacina_mg),
    vitamina_c_mg: toNumber(food.vitamina_c_mg),
    vitamina_e_mg: toNumber(food.vitamina_e_mg),
    kcal_por_100g: macros ? macros.kcal_por_100g : toNumber(food.energia_kcal),
    proteina_por_100g: macros ? macros.proteina_por_100g : toNumber(food.proteina_g),
    carbo_por_100g: macros ? macros.carbo_por_100g : toNumber(food.carboidrato_g),
    gordura_por_100g: macros ? macros.gordura_por_100g : toNumber(food.lipidios_g),
    fibra_por_100g: macros ? macros.fibra_por_100g : toNumber(food.fibra_g),
    sodio_mg_por_100g: macros ? macros.sodio_mg_por_100g : toNumber(food.sodio_mg),
    potassio_mg_por_100g: macros ? macros.potassio_mg_por_100g : toNumber(food.potassio_mg),
    calcio_mg_por_100g: macros ? macros.calcio_mg_por_100g : toNumber(food.calcio_mg),
    ferro_mg_por_100g: macros ? macros.ferro_mg_por_100g : toNumber(food.ferro_mg),
    raw: clone(food)
  };
}

function scoreSearchEntry(entry, normalizedQuery, queryTokens, sourcePriority) {
  var name = normalizeText(entry.nome);
  var blob = normalizeText([
    entry.nome,
    entry.code,
    entry.taco_id,
    entry.codigo_taco,
    entry.categoria,
    entry.grupo_equivalencia
  ].filter(Boolean).join(' '));
  var score = 0;

  if (!normalizedQuery) {
    return sourcePriority + (entry.prioridade != null ? Number(entry.prioridade) || 0 : 0) + (entry.priority != null ? Number(entry.priority) || 0 : 0);
  }

  if (name === normalizedQuery) score += 500;
  if (blob === normalizedQuery) score += 460;
  if (name.startsWith(normalizedQuery)) score += 140;
  if (blob.startsWith(normalizedQuery)) score += 120;
  if (name.indexOf(normalizedQuery) >= 0) score += 100;
  if (blob.indexOf(normalizedQuery) >= 0) score += 90;

  for (var i = 0; i < queryTokens.length; i += 1) {
    if (blob.indexOf(queryTokens[i]) >= 0) score += 15;
  }

  if (!score) return 0;
  score += sourcePriority;
  if (entry.prioridade != null) score += Number(entry.prioridade) || 0;
  if (entry.priority != null) score += Number(entry.priority) || 0;

  return score;
}

function buildSearchResults(entries, query, limit, sourcePriority) {
  var normalizedQuery = normalizeText(query);
  var queryTokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
  return entries
    .map(function (entry) {
      return {
        food: entry,
        score: scoreSearchEntry(entry, normalizedQuery, queryTokens, sourcePriority)
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
}

function isStrongMatch(entry, query) {
  var normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;
  var name = normalizeText(entry && entry.nome);
  if (name === normalizedQuery) return true;
  if (name.indexOf(normalizedQuery) >= 0) return true;
  var tokens = normalizedQuery.split(' ').filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(function (token) {
    return name.indexOf(token) >= 0;
  });
}

function searchPremiumFoods(query, options) {
  var settings = options || {};
  var limit = typeof settings.limit === 'number' && settings.limit > 0 ? settings.limit : 20;
  return buildSearchResults(getPremiumFoods().map(buildPremiumResult), query, limit, 120);
}

function searchNutritionFoods(query, options) {
  var settings = options || {};
  var limit = typeof settings.limit === 'number' && settings.limit > 0 ? settings.limit : 20;
  var premiumLimit = typeof settings.premiumLimit === 'number' && settings.premiumLimit > 0 ? settings.premiumLimit : limit;
  var tacoLimit = typeof settings.tacoLimit === 'number' && settings.tacoLimit > 0 ? settings.tacoLimit : limit;
  var premium = searchPremiumFoods(query, { limit: premiumLimit });
  var taco = tacoService.searchTacoFoods(query, { limit: tacoLimit }).map(buildTacoResult);
  var seen = Object.create(null);
  var combined = [];

  function pushUnique(entry) {
    if (!entry) return;
    var key = normalizeText(entry.nome) || String(entry.code || entry.taco_id || entry.id || '');
    if (!key || seen[key]) return;
    seen[key] = true;
    combined.push(entry);
  }

  premium.forEach(pushUnique);
  taco.forEach(pushUnique);
  return combined.slice(0, limit);
}

function findNutritionFood(query, options) {
  var settings = options || {};
  var normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;
  var searchLimit = typeof settings.limit === 'number' && settings.limit > 0 ? settings.limit : 10;
  var premium = searchPremiumFoods(query, { limit: searchLimit });
  if (premium.length && isStrongMatch(premium[0], normalizedQuery)) return premium[0];
  var taco = tacoService.searchTacoFoods(query, { limit: 1 });
  if (taco.length) return buildTacoResult(taco[0]);
  return premium.length ? premium[0] : null;
}

module.exports = {
  normalizeText: normalizeText,
  searchPremiumFoods: searchPremiumFoods,
  searchNutritionFoods: searchNutritionFoods,
  findNutritionFood: findNutritionFood
};
