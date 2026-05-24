'use strict';

var clinical = require('./diet_context_clinical');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function textMatchesAlias(foodName, alias) {
  var nFood = normalizeText(foodName);
  var nAlias = normalizeText(alias);
  var words = nAlias.split(/\s+/).filter(function(w) { return w.length > 2; });
  if (!words.length) return false;
  return words.every(function(word) { return nFood.indexOf(word) !== -1; });
}

// Returns false if a food's macros are implausible for its category
function validateFoodIntegrity(food) {
  var name = normalizeText(food.name || '');
  var grams = Number(food.grams || 100);
  if (grams <= 0) return true;

  var protein = Number(food.protein || 0);
  var carbs = Number(food.carbs || 0);
  var fat = Number(food.fat || 0);
  var protein100 = (protein / grams) * 100;
  var carbs100 = (carbs / grams) * 100;
  var fat100 = (fat / grams) * 100;

  // iogurte natural (não grego/skyr/proteico) deve ter proteína ≤ 6g/100g
  if (/iogurte/.test(name) && !/grego|skyr|proteico|high.?protein/.test(name)) {
    if (protein100 > 6) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[VALIDATED_FOOD_SELECTOR] Rejected "' + food.name + '": yogurt protein', protein100.toFixed(1), 'g/100g > 6');
      }
      return false;
    }
  }

  // maçã e frutas similares nunca têm proteína alta
  if (/^maca$|^maca |maça/.test(name) && !/amendoim|amendoas/.test(name)) {
    if (protein100 > 2) return false;
  }

  // ovos/claras devem ter carbo baixo
  if (/^ovo\b|^ovos\b|^claras\b/.test(name) && carbs100 > 5) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[VALIDATED_FOOD_SELECTOR] Rejected "' + food.name + '": egg carbs', carbs100.toFixed(1), 'g/100g > 5');
    }
    return false;
  }

  // proteínas animais (frango, peixe, carne) têm carbo próximo de zero
  if (/frango|patinho|tilapia|atum|salmao|sardinha|camarao|lula|mexilhao|peru|musculo|coxao|carne.?moida/.test(name)) {
    if (carbs100 > 3) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[VALIDATED_FOOD_SELECTOR] Rejected "' + food.name + '": meat carbs too high', carbs100.toFixed(1));
      }
      return false;
    }
  }

  // pão integral: proteína não deve ultrapassar 18g/100g
  if (/pao.?integral|pao.?frances|tortilha/.test(name) && protein100 > 18) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[VALIDATED_FOOD_SELECTOR] Rejected "' + food.name + '": bread protein', protein100.toFixed(1), 'g/100g > 18');
    }
    return false;
  }

  // oleaginosas/castanhas: fat deve ser > 30g/100g
  if (/castanhas|nozes|amendoas|pistache|amêndoas/.test(name) && grams >= 15 && fat100 < 20) {
    return false;
  }

  return true;
}

function isRestricted(food, restrictions, dislikes) {
  var text = normalizeText((restrictions || []).join(' '));
  var name = normalizeText(food.name || '');
  var subgroup = normalizeText(food.subgroupKey || '');
  var group = normalizeText(food.groupKey || '');

  if (/vegetarian|vegetariano/.test(text)) {
    if (group === 'proteinas' && !/ovos|laticinios|proteinas.vegetais|suplementos/.test(subgroup)) return true;
  }
  if (/vegano|vegan/.test(text)) {
    if (group === 'laticinios') return true;
    if (group === 'proteinas' && !/proteinas.vegetais/.test(subgroup)) return true;
  }
  if (/lactose|intolerancia.?lactose/.test(text)) {
    if (/iogurte|whey|leite|queijo|cottage|caseina/.test(name) && !/zero.?lactose|vegetal/.test(name)) return true;
  }
  if (dislikes && dislikes.length) {
    var nDislikes = dislikes.map(normalizeText).filter(Boolean);
    if (nDislikes.some(function(d) { return d.length > 2 && name.indexOf(d) !== -1; })) return true;
  }
  return false;
}

function getRelevantGroups(role, mealTipo) {
  var isMainMeal = /almoco|jantar/.test(mealTipo || '');
  var isSnack = /lanche|ceia/.test(mealTipo || '');
  var isBreakfast = /cafe_da_manha/.test(mealTipo || '');

  switch (role) {
    case 'protein':
      if (isMainMeal) return ['mealProteins'];
      if (isBreakfast) return ['breakfastProteins', 'fastProteins'];
      if (isSnack) return ['fastProteins', 'breakfastProteins'];
      return ['breakfastProteins', 'fastProteins', 'mealProteins'];
    case 'carb':
      if (isMainMeal) return ['mealCarbs'];
      if (isBreakfast) return ['breakfastCarbs', 'fastCarbs', 'supportCarbs'];
      if (isSnack) return ['fastCarbs', 'supportCarbs', 'breakfastCarbs'];
      return ['breakfastCarbs', 'fastCarbs', 'mealCarbs', 'supportCarbs'];
    case 'fat':
      if (isBreakfast || isSnack) return ['breakfastFats', 'fats'];
      return ['fats'];
    case 'fiber':
      return ['veggies'];
    case 'fluid':
      return ['fastProteins'];
    case 'optional':
      return ['supportCarbs', 'veggies'];
    default:
      return ['mealProteins'];
  }
}

function selectValidatedFoodFromBlueprint(foodRole, mealContext, profile, catalogLibrary, rotationIndex) {
  var role = foodRole.role || 'protein';
  var aliases = (foodRole.suggestedAliases || []).filter(function(a) { return a && typeof a === 'string' && a.trim(); });
  var restrictions = (profile && (profile.restricoesAlimentares || profile.restricoes)) || [];
  var dislikes = (profile && profile.alimentosEvitar) || [];
  var mealTipo = (mealContext && mealContext.tipo) || '';
  var idx = typeof rotationIndex === 'number' ? Math.abs(rotationIndex) : 0;

  var relevantGroups = getRelevantGroups(role, mealTipo);

  // Build deduplicated candidate pool
  var seen = {};
  var candidates = [];
  relevantGroups.forEach(function(groupName) {
    (catalogLibrary[groupName] || []).forEach(function(food) {
      if (!food || !food.code) return;
      if (seen[food.code]) return;
      if (isRestricted(food, restrictions, dislikes)) return;
      if (clinical.shouldAvoidFoodForClinical && clinical.shouldAvoidFoodForClinical(food, profile || {})) return;
      if (!validateFoodIntegrity(food)) return;
      seen[food.code] = true;
      candidates.push(food);
    });
  });

  if (!candidates.length) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[VALIDATED_FOOD_SELECTOR] No valid candidates for role:', role, 'mealTipo:', mealTipo);
    }
    return null;
  }

  // Score candidates by alias match (first alias match wins)
  var aliasMatched = [];
  var unmatched = [];

  candidates.forEach(function(food) {
    var matchIdx = -1;
    for (var i = 0; i < aliases.length; i++) {
      if (textMatchesAlias(food.name, aliases[i])) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx >= 0) {
      aliasMatched.push({ food: food, matchIdx: matchIdx });
    } else {
      unmatched.push(food);
    }
  });

  aliasMatched.sort(function(a, b) { return a.matchIdx - b.matchIdx; });
  var pool = aliasMatched.length > 0
    ? aliasMatched.map(function(x) { return x.food; })
    : candidates;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      '[CATALOG_MATCH] role:', role,
      '| meal:', mealTipo,
      '| aliases:', aliases.slice(0, 3).join(', '),
      '| matched:', aliasMatched.length,
      '| pool:', pool.length,
      '| selected:', pool[idx % pool.length] ? pool[idx % pool.length].name : 'none'
    );
  }

  return pool[idx % pool.length] || null;
}

module.exports = {
  selectValidatedFoodFromBlueprint: selectValidatedFoodFromBlueprint,
  validateFoodIntegrity: validateFoodIntegrity,
  textMatchesAlias: textMatchesAlias,
  isRestricted: isRestricted,
  getRelevantGroups: getRelevantGroups,
};
