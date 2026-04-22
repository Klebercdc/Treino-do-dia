'use strict';

// KRONIA Substitution Engine
// When the user requests a food swap, this engine:
//   1. Filters foods by same equivalence group (same meal role)
//   2. Removes blocked/incompatible foods
//   3. Scores remaining candidates
//   4. Returns an ordered list for display

var db = require('../../lib/nutrition/kronaFoodDatabase');

var round = function(v, d) {
  var f = Math.pow(10, typeof d === 'number' ? d : 1);
  return Math.round(Number(v || 0) * f) / f;
};

function normText(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function textMatchesAny(text, list) {
  var t = normText(text);
  return (list || []).some(function(item) { return t.indexOf(normText(item)) !== -1; });
}

// Check if a food is blocked for this user profile
function isFoodBlocked(food, profile) {
  var objetivo = normText(profile.objetivo || '');
  var restricoes = (profile.restricoes || []).map(normText);
  var alimentosEvitar = (profile.alimentosEvitar || []).map(normText);
  var patologias = (profile.patologias || []).map(normText);

  // Check hard pathology blocks
  if (food.patologias_bloqueadas && food.patologias_bloqueadas.length) {
    var blocked = food.patologias_bloqueadas.some(function(p) {
      return patologias.indexOf(normText(p)) !== -1;
    });
    if (blocked) return true;
  }

  // Check dietary restrictions (lactose, gluten, vegan, vegetarian)
  var foodName = normText(food.nome);
  if (restricoes.indexOf('lactose') !== -1 || restricoes.indexOf('intolerancia_lactose') !== -1) {
    if (/iogurte|whey|leite|cottage|queijo|skyr|kefir|caseina/.test(foodName)) return true;
  }
  if (restricoes.indexOf('gluten') !== -1) {
    if (/aveia|pao|macarrao|trigo|cuscuz|tortilha|seitan/.test(foodName)) return true;
  }
  if (restricoes.indexOf('vegano') !== -1 || restricoes.indexOf('vegan') !== -1) {
    if (food.subcategoria !== 'vegetal' && food.categoria !== 'fruta' && food.categoria !== 'leguminosa') {
      var allowedVegan = ['vegetal', 'oleaginosa', 'oleo', 'semente', 'fruta_gordurosa', 'cereal', 'grao', 'tuberculo', 'massa', 'pao', 'leguminosa'];
      if (allowedVegan.indexOf(food.subcategoria) === -1 && food.categoria !== 'gordura') {
        if (food.subcategoria !== 'vegetal' && food.subcategoria !== 'vegetal') {
          if (/frango|patinho|tilapia|salmao|atum|ovo|iogurte|whey|leite|cottage|queijo|aves|bovino|suino|peixes|frutos_do_mar|laticinios/.test(normText(food.subcategoria || ''))) return true;
          if (/frango|patinho|tilapia|salmao|atum|sardinha|ovo|iogurte|whey|leite|cottage|queijo/.test(foodName)) return true;
        }
      }
    }
  }
  if (restricoes.indexOf('vegetariano') !== -1 || restricoes.indexOf('vegetarian') !== -1) {
    if (/frango|patinho|tilapia|salmao|atum|sardinha|camarao|lula/.test(foodName)) return true;
  }

  // Check disliked foods
  if (textMatchesAny(food.nome, alimentosEvitar)) return true;

  // Check objective blocks
  if (food.objetivo_evitar && food.objetivo_evitar.length) {
    var evita = food.objetivo_evitar.some(function(o) { return normText(o) === objetivo; });
    if (evita) return true;
  }

  return false;
}

// Score a food candidate for a given profile and current block target
function scoreCandidate(food, profile, blockAlvo) {
  var score = food.prioridade || 5;
  var objetivo = normText(profile.objetivo || '');

  // Bonus if food is indicated for this objective
  if (food.objetivo_indicado && food.objetivo_indicado.some(function(o) { return normText(o) === objetivo; })) {
    score += 2;
  }

  // Bonus if food is in user's preference list
  if (textMatchesAny(food.nome, profile.preferencias || [])) {
    score += 3;
  }

  // Bonus for clinical compatibility
  var patologias = (profile.patologias || []).map(normText);
  if (patologias.length && food.patologias_permitidas && food.patologias_permitidas.length) {
    var allowed = food.patologias_permitidas.map(normText);
    var allCovered = patologias.every(function(p) { return allowed.indexOf(p) !== -1; });
    if (allCovered) score += 1;
  }

  // Macro proximity bonus: how close is this food's macro density to the block target
  if (blockAlvo) {
    var targetProtein = Number(blockAlvo.protein || 0);
    var targetCarbs   = Number(blockAlvo.carbs   || 0);
    var targetFat     = Number(blockAlvo.fat     || 0);
    var pDiff = Math.abs(food.proteina_por_100g - (targetProtein > 0 ? targetProtein : 0));
    var cDiff = Math.abs(food.carbo_por_100g    - (targetCarbs   > 0 ? targetCarbs   : 0));
    var fDiff = Math.abs(food.gordura_por_100g  - (targetFat     > 0 ? targetFat     : 0));
    var proximityPenalty = (pDiff + cDiff + fDiff) / 30;
    score = Math.max(0, score - proximityPenalty);
  }

  return round(score, 2);
}

// Calculate the grams needed so the replacement food delivers the same
// dominant macro as the original block target.
function calcEquivalentGrams(food, blockAlvo) {
  var alvo = blockAlvo || {};
  var targetProtein = Number(alvo.protein || 0);
  var targetCarbs   = Number(alvo.carbs   || 0);
  var targetFat     = Number(alvo.fat     || 0);

  var driverMacro, driverValue;
  if (targetProtein >= targetCarbs && targetProtein >= targetFat) {
    driverMacro = 'proteina_por_100g';
    driverValue = targetProtein;
  } else if (targetCarbs >= targetProtein && targetCarbs >= targetFat) {
    driverMacro = 'carbo_por_100g';
    driverValue = targetCarbs;
  } else {
    driverMacro = 'gordura_por_100g';
    driverValue = targetFat;
  }

  var macroPerGram = food[driverMacro] / 100;
  if (!macroPerGram || macroPerGram <= 0) return 100;
  var grams = driverValue / macroPerGram;
  return Math.min(500, Math.max(20, round(grams, 0)));
}

function calcItemNutrition(food, grams) {
  var ratio = grams / 100;
  return {
    calorias:      round(food.kcal_por_100g * ratio, 0),
    proteinas:     round(food.proteina_por_100g * ratio, 1),
    carboidratos:  round(food.carbo_por_100g * ratio, 1),
    gorduras:      round(food.gordura_por_100g * ratio, 1),
    fibras:        round(food.fibra_por_100g * ratio, 1)
  };
}

/**
 * Returns a list of eligible replacement foods for a block.
 *
 * @param {string} grupoEquivalencia - the equivalence group of the block to replace
 * @param {object} profile - user profile (objetivo, patologias, restricoes, preferencias, alimentosEvitar)
 * @param {object} blockAlvo - { protein, carbs, fat } targets for the block
 * @param {string} currentFoodCode - code of the food currently in the block (excluded)
 * @returns {Array} ordered list of candidates with calculated grams and nutrition
 */
function getSubstitutionOptions(grupoEquivalencia, profile, blockAlvo, currentFoodCode) {
  var candidates = db.getFoodsByEquivalenceGroup(grupoEquivalencia);

  // Fallback: if no same-group candidates, widen to same category
  if (candidates.length <= 1) {
    var currentFood = db.getFoodByCode(currentFoodCode);
    if (currentFood) {
      candidates = db.getFoodsByCategory(currentFood.categoria);
    }
  }

  var filtered = candidates.filter(function(food) {
    if (food.code === currentFoodCode) return false;
    if (isFoodBlocked(food, profile)) return false;
    return true;
  });

  var scored = filtered.map(function(food) {
    var score = scoreCandidate(food, profile, blockAlvo);
    var grams = calcEquivalentGrams(food, blockAlvo);
    var nutrition = calcItemNutrition(food, grams);
    return {
      food_code: food.code,
      nome: food.nome,
      categoria: food.categoria,
      subcategoria: food.subcategoria,
      grupo_equivalencia: food.grupo_equivalencia,
      gramas: grams,
      porcao: grams + ' g',
      nutrição: nutrition,
      score: score
    };
  });

  scored.sort(function(a, b) { return b.score - a.score; });

  return scored;
}

/**
 * Applies a substitution to a block. Returns the updated block.
 *
 * @param {object} block - the current block object
 * @param {string} newFoodCode - code of the food to substitute in
 * @param {object} profile - user profile
 * @returns {object} updated block
 */
function applySubstitution(block, newFoodCode, profile) {
  var food = db.getFoodByCode(newFoodCode);
  if (!food) throw new Error('Alimento não encontrado: ' + newFoodCode);
  if (isFoodBlocked(food, profile)) throw new Error('Alimento bloqueado para este perfil: ' + newFoodCode);

  var grams = calcEquivalentGrams(food, block.alvo_nutricional);
  var nutrition = calcItemNutrition(food, grams);

  return Object.assign({}, block, {
    food_code: food.code,
    nome: food.nome,
    categoria: food.categoria,
    subcategoria: food.subcategoria,
    grupo_equivalencia: food.grupo_equivalencia,
    gramas: grams,
    porcao: grams + ' g',
    nutrição: nutrition
  });
}

module.exports = {
  getSubstitutionOptions: getSubstitutionOptions,
  applySubstitution: applySubstitution,
  isFoodBlocked: isFoodBlocked,
  scoreCandidate: scoreCandidate,
  calcEquivalentGrams: calcEquivalentGrams,
  calcItemNutrition: calcItemNutrition
};
