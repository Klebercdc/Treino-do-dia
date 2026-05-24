'use strict';

var PROTEIN_THRESHOLDS = {
  'iogurte natural': { min: 3.0, max: 5.0, repairName: null },
  'iogurte grego': { min: 8.0, max: 12.0, repairName: null },
  'skyr': { min: 10.0, max: 18.0, repairName: null },
  'iogurte proteico': { min: 10.0, max: 20.0, repairName: null },
  'frango': { min: 25.0, max: 34.0, repairName: null },
  'peixe': { min: 18.0, max: 28.0, repairName: null },
  'salmao': { min: 20.0, max: 25.0, repairName: null },
  'ovo': { min: 10.0, max: 14.0, repairName: null },
  'maca': { min: 0.0, max: 0.8, repairName: null },
  'banana': { min: 0.5, max: 2.0, repairName: null }
};

var SEMANTIC_RULES = [
  {
    pattern: /iogurte.*natural|iogurte\s+integr/i,
    protein_min: 3.0,
    protein_max: 5.0,
    carbs_min: 3.0,
    carbs_max: 6.0,
    fat_min: 0.0,
    fat_max: 5.0,
    repair_name: null,
    repair_label: 'iogurte natural'
  },
  {
    pattern: /iogurte.*grego|iogurte.*proteic/i,
    protein_min: 8.0,
    protein_max: 14.0,
    carbs_min: 2.0,
    carbs_max: 8.0,
    fat_min: 0.0,
    fat_max: 10.0,
    repair_name: null,
    repair_label: 'iogurte grego'
  },
  {
    pattern: /frango/i,
    protein_min: 25.0,
    protein_max: 34.0,
    carbs_min: 0.0,
    carbs_max: 2.0,
    fat_min: 2.0,
    fat_max: 10.0,
    repair_name: null,
    repair_label: 'frango'
  },
  {
    pattern: /salmao|salmão/i,
    protein_min: 20.0,
    protein_max: 26.0,
    carbs_min: 0.0,
    carbs_max: 5.0,
    fat_min: 8.0,
    fat_max: 18.0,
    repair_name: null,
    repair_label: 'salmão'
  },
  {
    pattern: /^(maca|maçã|maca\b)/i,
    protein_min: 0.0,
    protein_max: 0.8,
    carbs_min: 10.0,
    carbs_max: 18.0,
    fat_min: 0.0,
    fat_max: 0.8,
    repair_name: null,
    repair_label: 'maçã'
  },
  {
    pattern: /arroz.*cozido|arroz branco/i,
    protein_min: 1.5,
    protein_max: 4.0,
    carbs_min: 22.0,
    carbs_max: 32.0,
    fat_min: 0.0,
    fat_max: 1.5,
    repair_name: null,
    repair_label: 'arroz cozido'
  },
  {
    pattern: /feijao|feijão/i,
    protein_min: 4.0,
    protein_max: 10.0,
    carbs_min: 10.0,
    carbs_max: 18.0,
    fat_min: 0.0,
    fat_max: 2.0,
    repair_name: null,
    repair_label: 'feijão'
  },
  {
    pattern: /espinafre|folha|alface|rucula/i,
    protein_min: 0.0,
    protein_max: 3.5,
    carbs_min: 0.0,
    carbs_max: 6.0,
    fat_min: 0.0,
    fat_max: 1.5,
    repair_name: null,
    repair_label: 'vegetal folha'
  }
];

function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function getMacros100g(item) {
  var grams = Number(item.gramas || item.grams || 100);
  if (grams <= 0) grams = 100;
  var ratio = grams / 100;
  return {
    protein: Number(item.proteinas != null ? item.proteinas : (item.protein || 0)) / ratio,
    carbs: Number(item.carboidratos != null ? item.carboidratos : (item.carbs || 0)) / ratio,
    fat: Number(item.gorduras != null ? item.gorduras : (item.fat || 0)) / ratio,
    calories: Number(item.calorias != null ? item.calorias : (item.calories || 0)) / ratio
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
  var normalizedTarget = normalizeName(name);
  var lists = Object.values(catalog);
  for (var i = 0; i < lists.length; i++) {
    if (!Array.isArray(lists[i])) continue;
    for (var j = 0; j < lists[i].length; j++) {
      var food = lists[i][j];
      if (!food) continue;
      if (normalizeName(food.name) === normalizedTarget) return food;
      if (normalizeName(food.nome) === normalizedTarget) return food;
    }
  }
  return null;
}

function normalizeFoodSemantic(item) {
  if (!item) return item;
  var name = String(item.nome || item.name || '');
  var macros = getMacros100g(item);

  // Iogurte natural with hyperprotein values → rename to iogurte grego
  if (/iogurte.*natural/i.test(name) && macros.protein > 7) {
    return Object.assign({}, item, {
      nome: item.nome ? 'Iogurte grego natural' : item.name,
      name: item.name ? 'Iogurte grego natural' : item.nome
    });
  }

  return item;
}

function classifyFoodSemantic(item) {
  if (!item) return 'mixed';
  var macros = getMacros100g(item);
  var name = normalizeName(item.nome || item.name || '');

  if (/espinafre|alface|rucula|couve|brocolis|salada|vegetais|legumes|cenoura|abobrinha|berinjela|chuchu|vagem|pepino|tomate|pimentao|cogumelo/.test(name)) return 'vegetable';
  if (/maca|banana|laranja|manga|morango|uva|kiwi|pera|fruta|abacaxi|mamao|melao|pessego|ameixa|caqui/.test(name)) return 'fruit';

  if (macros.protein >= 15 && macros.protein > macros.carbs && macros.protein > macros.fat) return 'protein_source';
  if (macros.carbs >= 15 && macros.carbs > macros.protein && macros.carbs > macros.fat) return 'carb_source';
  if (macros.fat >= 15 && macros.fat > macros.protein) return 'fat_source';
  if (macros.protein >= 8 && macros.carbs >= 10) return 'mixed';

  return 'mixed';
}

function validateFoodSemantic(item, catalog) {
  if (!item) return { valid: false, warnings: ['Item nulo'], suggestedFoodCode: null };

  var warnings = [];
  var suggestedFoodCode = null;

  if (!item.source) {
    warnings.push('Campo source ausente');
  }

  var name = String(item.nome || item.name || '');
  var macros = getMacros100g(item);

  var matchedRule = null;
  for (var i = 0; i < SEMANTIC_RULES.length; i++) {
    if (SEMANTIC_RULES[i].pattern.test(name)) {
      matchedRule = SEMANTIC_RULES[i];
      break;
    }
  }

  if (matchedRule) {
    if (macros.protein < matchedRule.protein_min || macros.protein > matchedRule.protein_max) {
      warnings.push(
        'Proteína incoerente para ' + matchedRule.repair_label + ': ' +
        macros.protein.toFixed(1) + 'g/100g (esperado: ' +
        matchedRule.protein_min + '–' + matchedRule.protein_max + 'g/100g)'
      );
    }
    if (macros.carbs < matchedRule.carbs_min || macros.carbs > matchedRule.carbs_max) {
      warnings.push(
        'Carboidrato incoerente para ' + matchedRule.repair_label + ': ' +
        macros.carbs.toFixed(1) + 'g/100g (esperado: ' +
        matchedRule.carbs_min + '–' + matchedRule.carbs_max + 'g/100g)'
      );
    }
    if (macros.fat < matchedRule.fat_min || macros.fat > matchedRule.fat_max) {
      warnings.push(
        'Gordura incoerente para ' + matchedRule.repair_label + ': ' +
        macros.fat.toFixed(1) + 'g/100g (esperado: ' +
        matchedRule.fat_min + '–' + matchedRule.fat_max + 'g/100g)'
      );
    }
  }

  if (isNaN(macros.protein) || isNaN(macros.carbs) || isNaN(macros.fat) || isNaN(macros.calories)) {
    warnings.push('Valores NaN detectados nos macros');
  }

  if (catalog) {
    var catalogItem = findCatalogItemByCode(catalog, item.foodCode || item.code);
    if (!catalogItem) {
      catalogItem = findCatalogItemByName(catalog, name);
      if (catalogItem) suggestedFoodCode = catalogItem.code || catalogItem.foodCode;
    }
  }

  return {
    valid: warnings.length === 0,
    warnings: warnings,
    suggestedFoodCode: suggestedFoodCode
  };
}

function repairFoodSemantic(item, catalog) {
  if (!item) return null;

  var validation = validateFoodSemantic(item, catalog);
  if (validation.valid) {
    return Object.assign({}, item, {
      semanticStatus: 'valid',
      semanticWarnings: []
    });
  }

  var repaired = Object.assign({}, item);
  var repairs = [];
  var wasRepaired = false;

  // Normalize name first
  var normalized = normalizeFoodSemantic(repaired);
  if (normalized.nome !== repaired.nome || normalized.name !== repaired.name) {
    repaired = Object.assign({}, repaired, normalized);
    repairs.push('Nome normalizado semanticamente');
    wasRepaired = true;
  }

  // Add default source if missing
  if (!repaired.source) {
    repaired = Object.assign({}, repaired, { source: 'estimativa_validada' });
    repairs.push('source ausente: marcado como estimativa_validada');
    wasRepaired = true;
  }

  // Try to remap from catalog
  if (catalog && validation.suggestedFoodCode) {
    var catalogItem = findCatalogItemByCode(catalog, validation.suggestedFoodCode);
    if (catalogItem) {
      var grams = Number(repaired.gramas || repaired.grams || catalogItem.grams || 100);
      var ratio = grams / 100;
      repaired = Object.assign({}, repaired, {
        foodCode: catalogItem.code || catalogItem.foodCode || repaired.foodCode,
        nome: catalogItem.name || catalogItem.nome || repaired.nome,
        source: catalogItem.source || repaired.source,
        calorias: Math.round((catalogItem.calories || 0) * ratio / grams * grams),
        proteinas: Math.round((catalogItem.protein || 0) * ratio * 10) / 10,
        carboidratos: Math.round((catalogItem.carbs || 0) * ratio * 10) / 10,
        gorduras: Math.round((catalogItem.fat || 0) * ratio * 10) / 10
      });
      repairs.push('Remapeado pelo catálogo: ' + (catalogItem.name || catalogItem.nome));
      return Object.assign({}, repaired, {
        semanticStatus: 'substituted',
        semanticWarnings: validation.warnings,
        _semanticRepairs: repairs
      });
    }
  }

  // Check if macros are incoherent beyond repair (still NaN after all attempts)
  var finalMacros = getMacros100g(repaired);
  if (isNaN(finalMacros.protein) || isNaN(finalMacros.carbs) || isNaN(finalMacros.fat) || isNaN(finalMacros.calories)) {
    return Object.assign({}, repaired, {
      semanticStatus: 'flagged',
      semanticWarnings: validation.warnings.concat(['Macros inválidos após tentativa de reparo']),
      _semanticRepairs: repairs
    });
  }

  // Check if macro incoherence is too severe to repair without catalog
  var name = String(repaired.nome || repaired.name || '');
  var hasSevereProteinIssue = false;
  for (var i = 0; i < SEMANTIC_RULES.length; i++) {
    var rule = SEMANTIC_RULES[i];
    if (rule.pattern.test(name)) {
      if (finalMacros.protein > rule.protein_max * 2 || finalMacros.carbs > rule.carbs_max * 2) {
        hasSevereProteinIssue = true;
      }
      break;
    }
  }

  if (hasSevereProteinIssue && !wasRepaired) {
    return Object.assign({}, repaired, {
      semanticStatus: 'flagged',
      semanticWarnings: validation.warnings,
      _semanticRepairs: repairs
    });
  }

  return Object.assign({}, repaired, {
    semanticStatus: wasRepaired ? 'repaired' : 'repaired',
    semanticWarnings: validation.warnings,
    _semanticRepairs: repairs
  });
}

function validateMealSemantic(meal, catalog) {
  if (!meal) return meal;
  var items = Array.isArray(meal.itens) ? meal.itens : [];
  var repairedItems = items.map(function(item) {
    if (!item) return item;
    if (item.semanticStatus) return item;
    return repairFoodSemantic(item, catalog);
  });

  var hasInvalid = repairedItems.some(function(item) {
    return item && item.semanticStatus === 'flagged';
  });

  return Object.assign({}, meal, {
    itens: repairedItems,
    semanticValid: !hasInvalid
  });
}

function validatePlanSemantic(plan, catalog) {
  if (!plan) return plan;
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var validatedMeals = meals.map(function(meal) {
    return validateMealSemantic(meal, catalog);
  });

  var allValid = validatedMeals.every(function(meal) {
    return meal && meal.semanticValid !== false;
  });

  return Object.assign({}, plan, {
    refeicoes: validatedMeals,
    premiumValidation: Object.assign({}, plan.premiumValidation || {}, {
      semanticValidation: allValid
    })
  });
}

function assertSemanticIntegrity(plan) {
  if (!plan) throw new Error('assertSemanticIntegrity: plano nulo');
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var violations = [];

  meals.forEach(function(meal, mi) {
    var items = Array.isArray(meal && meal.itens) ? meal.itens : [];
    items.forEach(function(item, ii) {
      if (!item) return;
      if (!item.semanticStatus) {
        violations.push('Refeição ' + mi + ' item ' + ii + ' (' + (item.nome || item.name || '?') + '): semanticStatus ausente');
      }
    });
  });

  if (violations.length > 0) {
    throw new Error('Falha de integridade semântica:\n' + violations.join('\n'));
  }
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
