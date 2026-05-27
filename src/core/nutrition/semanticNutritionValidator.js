'use strict';

var SEMANTIC_RULES = [
  { pattern: /iogurte.*grego|iogurte.*proteic|skyr|high.?protein/i, protein_min: 7, protein_max: 20, carbs_min: 0, carbs_max: 14, fat_min: 0, fat_max: 10, repair_label: 'iogurte proteico' },
  { pattern: /iogurte.*natural|iogurte\s+integr/i, protein_min: 3, protein_max: 5, carbs_min: 3, carbs_max: 8, fat_min: 0, fat_max: 6, repair_label: 'iogurte natural' },
  { pattern: /frango/i, protein_min: 25, protein_max: 38, carbs_min: 0, carbs_max: 2, fat_min: 1, fat_max: 12, repair_label: 'frango' },
  { pattern: /salmao|salmão/i, protein_min: 18, protein_max: 30, carbs_min: 0, carbs_max: 2, fat_min: 5, fat_max: 22, repair_label: 'salmão' },
  { pattern: /^(maca|maçã)\b/i, protein_min: 0, protein_max: 1, carbs_min: 8, carbs_max: 18, fat_min: 0, fat_max: 1, repair_label: 'maçã' },
  { pattern: /^ovos?\b|ovos.*mexidos|ovo.*cozido/i, protein_min: 8, protein_max: 16, carbs_min: 0, carbs_max: 4, fat_min: 5, fat_max: 14, repair_label: 'ovo' },
  { pattern: /nozes|castanha|amendoa|amêndoa|pistache/i, protein_min: 5, protein_max: 25, carbs_min: 5, carbs_max: 35, fat_min: 35, fat_max: 75, repair_label: 'oleaginosa' },
  { pattern: /pao.*integral|pão.*integral/i, protein_min: 6, protein_max: 16, carbs_min: 35, carbs_max: 65, fat_min: 1, fat_max: 10, repair_label: 'pão integral' },
  { pattern: /arroz.*cozido|arroz branco|arroz integral/i, protein_min: 1.5, protein_max: 5, carbs_min: 20, carbs_max: 35, fat_min: 0, fat_max: 3, repair_label: 'arroz cozido' },
  { pattern: /feijao|feijão/i, protein_min: 4, protein_max: 12, carbs_min: 10, carbs_max: 25, fat_min: 0, fat_max: 3, repair_label: 'feijão' },
  { pattern: /espinafre|brocolis|brócolis|folha|alface|rucula|rúcula/i, protein_min: 0, protein_max: 5, carbs_min: 0, carbs_max: 10, fat_min: 0, fat_max: 2, repair_label: 'vegetal' }
];

function normalizeName(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getMacros100g(item) {
  var grams = Number(item && (item.gramas || item.grams) || 100);
  if (!Number.isFinite(grams) || grams <= 0) grams = 100;
  var ratio = grams / 100;
  return {
    protein: Number(item && (item.proteinas != null ? item.proteinas : item.protein) || 0) / ratio,
    carbs: Number(item && (item.carboidratos != null ? item.carboidratos : item.carbs) || 0) / ratio,
    fat: Number(item && (item.gorduras != null ? item.gorduras : item.fat) || 0) / ratio,
    calories: Number(item && (item.calorias != null ? item.calorias : item.calories) || 0) / ratio
  };
}

function findCatalogItemByCode(catalog, code) {
  if (!catalog || !code) return null;
  var lists = Object.values(catalog);
  for (var i = 0; i < lists.length; i++) {
    if (!Array.isArray(lists[i])) continue;
    for (var j = 0; j < lists[i].length; j++) {
      var food = lists[i][j];
      if (food && (food.code === code || food.foodCode === code)) return food;
    }
  }
  return null;
}

function findCatalogItemByName(catalog, name) {
  if (!catalog || !name) return null;
  var target = normalizeName(name);
  var lists = Object.values(catalog);
  for (var i = 0; i < lists.length; i++) {
    if (!Array.isArray(lists[i])) continue;
    for (var j = 0; j < lists[i].length; j++) {
      var food = lists[i][j];
      if (food && normalizeName(food.name || food.nome) === target) return food;
    }
  }
  return null;
}

function normalizeFoodSemantic(item) {
  if (!item) return item;
  var name = String(item.nome || item.name || '');
  var macros = getMacros100g(item);

  if (/iogurte/i.test(name) && !/natural|grego|skyr|proteic|high.?protein|whey/i.test(name) && macros.protein >= 8) {
    return Object.assign({}, item, {
      nome: 'Iogurte proteico natural',
      name: 'Iogurte proteico natural',
      semanticAdjusted: true
    });
  }

  if (/iogurte.*natural/i.test(name) && !/grego|skyr|proteic|high.?protein|whey/i.test(name) && macros.protein > 7) {
    return Object.assign({}, item, { nome: 'Iogurte grego natural', name: 'Iogurte grego natural' });
  }

  if (/pao.*integral|pão.*integral/i.test(name)) {
    var portionProtein = Number(item.proteinas || item.protein || 0);
    if (portionProtein > 0 && portionProtein < 4) {
      item = Object.assign({}, item, { proteinas: 5, protein: 5 });
    }
    var portion = String(item.porcao || item.portionLabel || '');
    var grams = Number(item.gramas || item.grams || 0);
    if (portion && !/\d+\s*g/i.test(portion) && grams > 0) {
      return Object.assign({}, item, { porcao: portion + ' (' + grams + ' g)' });
    }
    return item;
  }

  return item;
}

function classifyFoodSemantic(item) {
  if (!item) return 'mixed';
  var macros = getMacros100g(item);
  var name = normalizeName(item.nome || item.name || '');
  if (/espinafre|alface|rucula|couve|brocolis|salada|vegetais|legumes/.test(name)) return 'vegetable';
  if (/maca|banana|laranja|manga|morango|uva|kiwi|pera|fruta/.test(name)) return 'fruit';
  if (macros.protein >= 15 && macros.protein > macros.carbs && macros.protein >= macros.fat) return 'protein_source';
  if (macros.carbs >= 15 && macros.carbs > macros.protein && macros.carbs > macros.fat) return 'carb_source';
  if (macros.fat >= 20 && macros.fat > macros.protein) return 'fat_source';
  return 'mixed';
}

function matchRule(name) {
  var normalizedName = normalizeName(name);
  for (var i = 0; i < SEMANTIC_RULES.length; i++) {
    if (SEMANTIC_RULES[i].pattern.test(name) || SEMANTIC_RULES[i].pattern.test(normalizedName)) return SEMANTIC_RULES[i];
  }
  return null;
}

function validateFoodSemantic(item, catalog) {
  if (!item) return { valid: false, warnings: ['Item nulo'], suggestedFoodCode: null };
  var warnings = [];
  var suggestedFoodCode = null;
  var name = String(item.nome || item.name || '');
  var macros = getMacros100g(item);
  var normalized = normalizeFoodSemantic(item);

  if (!item.source) warnings.push('Campo source ausente');
  if (normalized.nome !== item.nome || normalized.name !== item.name || normalized.porcao !== item.porcao) warnings.push('Normalização semântica necessária');

  var rule = matchRule(name);
  if (rule) {
    if (macros.protein < rule.protein_min || macros.protein > rule.protein_max) warnings.push('Proteína incoerente para ' + rule.repair_label + ': ' + macros.protein.toFixed(1) + 'g/100g');
    if (macros.carbs < rule.carbs_min || macros.carbs > rule.carbs_max) warnings.push('Carboidrato incoerente para ' + rule.repair_label + ': ' + macros.carbs.toFixed(1) + 'g/100g');
    if (macros.fat < rule.fat_min || macros.fat > rule.fat_max) warnings.push('Gordura incoerente para ' + rule.repair_label + ': ' + macros.fat.toFixed(1) + 'g/100g');
  }

  if ([macros.protein, macros.carbs, macros.fat, macros.calories].some(function(v) { return !Number.isFinite(v); })) warnings.push('Valores NaN detectados nos macros');

  if (catalog) {
    var catalogItem = findCatalogItemByCode(catalog, item.foodCode || item.code) || findCatalogItemByName(catalog, name);
    if (catalogItem) suggestedFoodCode = catalogItem.code || catalogItem.foodCode || null;
  }

  return { valid: warnings.length === 0, warnings: warnings, suggestedFoodCode: suggestedFoodCode };
}

function repairFoodSemantic(item, catalog) {
  if (!item) return null;
  var validation = validateFoodSemantic(item, catalog);
  var normalized = normalizeFoodSemantic(item);
  var repairs = [];
  var repaired = Object.assign({}, item, normalized);

  if (normalized.nome !== item.nome || normalized.name !== item.name || normalized.porcao !== item.porcao) repairs.push('Nome/porção normalizado semanticamente');

  if (!repaired.source) {
    repaired.source = 'estimativa_validada';
    repairs.push('source ausente marcado como estimativa_validada');
  }

  var status = validation.valid && !repairs.length ? 'valid' : (repairs.length ? 'repaired' : 'flagged');

  return Object.assign({}, repaired, {
    semanticStatus: status,
    semanticWarnings: repairs.length ? validation.warnings.concat(repairs) : validation.warnings,
    _semanticRepairs: repairs
  });
}

function validateMealSemantic(meal, catalog) {
  if (!meal) return meal;
  var repairedItems = (Array.isArray(meal.itens) ? meal.itens : []).map(function(item) { return repairFoodSemantic(item, catalog); });
  var hasInvalid = repairedItems.some(function(item) { return item && item.semanticStatus === 'flagged'; });
  return Object.assign({}, meal, { itens: repairedItems, semanticValid: !hasInvalid });
}

function validatePlanSemantic(plan, catalog) {
  if (!plan) return plan;
  var validatedMeals = (Array.isArray(plan.refeicoes) ? plan.refeicoes : []).map(function(meal) { return validateMealSemantic(meal, catalog); });
  var allValid = validatedMeals.every(function(meal) { return meal && meal.semanticValid !== false; });
  return Object.assign({}, plan, {
    refeicoes: validatedMeals,
    premiumValidation: Object.assign({}, plan.premiumValidation || {}, { semanticValidation: allValid })
  });
}

function assertSemanticIntegrity(plan) {
  if (!plan) throw new Error('assertSemanticIntegrity: plano nulo');
  var violations = [];
  (plan.refeicoes || []).forEach(function(meal, mi) {
    (meal.itens || []).forEach(function(item, ii) {
      if (!item || !item.semanticStatus) violations.push('Refeição ' + mi + ' item ' + ii + ': semanticStatus ausente');
    });
  });
  if (violations.length) throw new Error('Falha de integridade semântica:\n' + violations.join('\n'));
}

module.exports = {
  normalizeFoodSemantic: normalizeFoodSemantic,
  classifyFoodSemantic: classifyFoodSemantic,
  validateFoodSemantic: validateFoodSemantic,
  repairFoodSemantic: repairFoodSemantic,
  validateMealSemantic: validateMealSemantic,
  validatePlanSemantic: validatePlanSemantic,
  assertSemanticIntegrity: assertSemanticIntegrity
};
