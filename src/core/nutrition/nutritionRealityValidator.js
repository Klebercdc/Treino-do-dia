'use strict';

// Ranges per food category — all values per 100g unless stated
var FOOD_RANGES = {
  aves: {
    pattern: /frango|peito.*peru|sobrecoxa|chester|peru.*assado/,
    protein_min: 20, protein_max: 38,
    carbs_max: 3,
    fat_min: 1, fat_max: 20,
    kcal_min: 100, kcal_max: 280,
    label: 'ave/frango'
  },
  bovinos: {
    pattern: /patinho|coxao|musculo|carne.*moida|file.*bovino|alcatra|contrafile/,
    protein_min: 18, protein_max: 36,
    carbs_max: 3,
    fat_min: 2, fat_max: 25,
    kcal_min: 130, kcal_max: 330,
    label: 'carne bovina'
  },
  peixes_brancos: {
    pattern: /tilapia|merluza|pescada|linguado|bacalhau|tambaqui|pintado/,
    protein_min: 18, protein_max: 32,
    carbs_max: 3,
    fat_min: 0.3, fat_max: 8,
    kcal_min: 70, kcal_max: 200,
    label: 'peixe branco'
  },
  peixes_gordos: {
    pattern: /salmao|sardinha|atum|cavalinha|anchova/,
    protein_min: 18, protein_max: 35,
    carbs_max: 3,
    fat_min: 3, fat_max: 30,
    kcal_min: 100, kcal_max: 350,
    label: 'peixe gordo'
  },
  ovos: {
    pattern: /^ovo\b|^ovos\b|^claras\b|ovo.cozido|ovos.mexidos|ovo.estrelado/,
    protein_min: 8, protein_max: 14,
    carbs_max: 4,
    fat_max: 12,
    kcal_min: 40, kcal_max: 220,
    label: 'ovo'
  },
  iogurte_natural: {
    pattern: /iogurte/,
    excludePattern: /grego|skyr|proteico|high.?protein|whey/,
    protein_max: 6,
    kcal_min: 35, kcal_max: 90,
    label: 'iogurte natural comum'
  },
  iogurte_grego: {
    pattern: /iogurte.*(grego|skyr|proteico|high.?protein)/,
    protein_min: 5, protein_max: 18,
    carbs_max: 10,
    kcal_min: 50, kcal_max: 160,
    label: 'iogurte grego/proteico'
  },
  pao: {
    pattern: /pao.?integral|pao.?frances|pao.?sirio|tortilha.?integral/,
    protein_max: 14,
    carbs_min: 38, carbs_max: 65,
    kcal_min: 200, kcal_max: 360,
    label: 'pão'
  },
  maca: {
    pattern: /^maca$|^maca\s/,
    excludePattern: /amendoim|ameixa|pasta/,
    protein_max: 1,
    fat_max: 1,
    kcal_min: 30, kcal_max: 90,
    label: 'maçã'
  },
  oleaginosas: {
    pattern: /^castanhas?\b|^nozes\b|^amendoas?\b|^pistache\b|castanha.do.para/,
    fat_min: 35,
    kcal_min: 350,
    label: 'oleaginosas'
  },
  arroz: {
    pattern: /arroz.cozido|arroz.integral.cozido/,
    protein_max: 5,
    carbs_min: 20, carbs_max: 42,
    kcal_min: 90, kcal_max: 190,
    label: 'arroz cozido'
  },
  feijao: {
    pattern: /feijao.cozido|feijao.carioca/,
    protein_max: 10,
    carbs_min: 8, carbs_max: 22,
    kcal_min: 55, kcal_max: 130,
    label: 'feijão cozido'
  },
  banana: {
    pattern: /^banana/,
    protein_max: 2,
    fat_max: 1,
    carbs_min: 15, carbs_max: 30,
    kcal_min: 60, kcal_max: 120,
    label: 'banana'
  }
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMacros100g(item) {
  var grams = Number(item.gramas || item.grams || 100);
  if (grams <= 0) grams = 100;
  var ratio = 100 / grams;
  return {
    protein: Number(item.proteinas || item.protein || 0) * ratio,
    carbs: Number(item.carboidratos || item.carbs || 0) * ratio,
    fat: Number(item.gorduras || item.fat || 0) * ratio,
    kcal: Number(item.calorias || item.calories || 0) * ratio
  };
}

function matchCategory(name) {
  var n = normalizeText(name);
  var keys = Object.keys(FOOD_RANGES);
  for (var i = 0; i < keys.length; i++) {
    var cat = FOOD_RANGES[keys[i]];
    if (!cat.pattern.test(n)) continue;
    if (cat.excludePattern && cat.excludePattern.test(n)) continue;
    return { key: keys[i], cat: cat };
  }
  return null;
}

function validateFoodItem(item) {
  var name = item && (item.nome || item.name);
  if (!name) return { valid: true, warnings: [] };

  var match = matchCategory(name);
  if (!match) return { valid: true, warnings: [] };

  var m = getMacros100g(item);
  var cat = match.cat;
  var warnings = [];
  var valid = true;

  if (cat.protein_min != null && m.protein < cat.protein_min) {
    warnings.push(cat.label + ': proteína ' + m.protein.toFixed(1) + 'g/100g abaixo do esperado (min ' + cat.protein_min + 'g)');
    valid = false;
  }
  if (cat.protein_max != null && m.protein > cat.protein_max) {
    warnings.push(cat.label + ': proteína ' + m.protein.toFixed(1) + 'g/100g acima do esperado (max ' + cat.protein_max + 'g)');
    valid = false;
  }
  if (cat.carbs_max != null && m.carbs > cat.carbs_max) {
    warnings.push(cat.label + ': carbo ' + m.carbs.toFixed(1) + 'g/100g acima do esperado (max ' + cat.carbs_max + 'g)');
    valid = false;
  }
  if (cat.carbs_min != null && m.carbs < cat.carbs_min) {
    warnings.push(cat.label + ': carbo ' + m.carbs.toFixed(1) + 'g/100g abaixo do esperado (min ' + cat.carbs_min + 'g)');
    valid = false;
  }
  if (cat.fat_min != null && m.fat < cat.fat_min) {
    warnings.push(cat.label + ': gordura ' + m.fat.toFixed(1) + 'g/100g abaixo do esperado (min ' + cat.fat_min + 'g)');
  }
  if (cat.kcal_min != null && m.kcal < cat.kcal_min) {
    warnings.push(cat.label + ': kcal ' + Math.round(m.kcal) + '/100g abaixo do esperado (min ' + cat.kcal_min + ')');
    valid = false;
  }
  if (cat.kcal_max != null && m.kcal > cat.kcal_max) {
    warnings.push(cat.label + ': kcal ' + Math.round(m.kcal) + '/100g acima do esperado (max ' + cat.kcal_max + ')');
    valid = false;
  }

  return { valid: valid, warnings: warnings, categoryKey: match.key };
}

function validateMeal(meal) {
  var items = (meal && meal.itens) || [];
  var allWarnings = [];
  var allValid = true;
  items.forEach(function(item) {
    var result = validateFoodItem(item);
    if (!result.valid) allValid = false;
    result.warnings.forEach(function(w) {
      allWarnings.push('[' + (item.nome || 'item') + '] ' + w);
    });
  });
  return { valid: allValid, warnings: allWarnings };
}

function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.refeicoes)) return { valid: true, warnings: [] };
  var allWarnings = [];
  var allValid = true;
  plan.refeicoes.forEach(function(meal) {
    var result = validateMeal(meal);
    if (!result.valid) allValid = false;
    result.warnings.forEach(function(w) {
      allWarnings.push('[' + (meal.nome || meal.tipo || 'refeição') + '] ' + w);
    });
  });
  return { valid: allValid, warnings: allWarnings };
}

function repairFoodItem(item, catalogLibrary) {
  var result = validateFoodItem(item);
  if (result.valid) return item;

  var name = normalizeText(item.nome || item.name || '');
  var match = matchCategory(name);
  if (!match || !catalogLibrary) {
    return Object.assign({}, item, { _validationWarnings: result.warnings });
  }

  var groups = Object.keys(catalogLibrary);
  for (var g = 0; g < groups.length; g++) {
    var group = catalogLibrary[groups[g]];
    if (!Array.isArray(group)) continue;
    for (var f = 0; f < group.length; f++) {
      var candidate = group[f];
      if (!candidate || !candidate.name) continue;
      var candidateMatch = matchCategory(candidate.name);
      if (!candidateMatch || candidateMatch.key !== match.key) continue;
      var candidateItem = {
        nome: candidate.name,
        gramas: candidate.grams || 100,
        proteinas: candidate.protein || 0,
        carboidratos: candidate.carbs || 0,
        gorduras: candidate.fat || 0,
        calorias: candidate.calories || 0
      };
      var candidateValid = validateFoodItem(candidateItem);
      if (candidateValid.valid) {
        return Object.assign({}, item, {
          nome: candidate.name,
          porcao: candidate.portionLabel || (candidate.grams ? candidate.grams + ' g' : null) || item.porcao,
          gramas: candidate.grams || item.gramas,
          calorias: candidate.calories || item.calorias,
          proteinas: candidate.protein || item.proteinas,
          carboidratos: candidate.carbs || item.carboidratos,
          gorduras: candidate.fat || item.gorduras,
          fibras: candidate.fiber || item.fibras || 0,
          source: candidate.source || item.source,
          _repairedBy: 'nutritionRealityValidator'
        });
      }
    }
  }

  return Object.assign({}, item, { _validationWarnings: result.warnings, _validationFailed: true });
}

function assertPlanIntegrity(plan) {
  var issues = [];
  if (!plan) { issues.push('plan is null/undefined'); return issues; }

  var meals = plan.refeicoes || [];
  if (!meals.length) { issues.push('no meals in plan'); return issues; }

  var sumCalories = 0, sumProtein = 0, sumCarbs = 0, sumFat = 0;
  meals.forEach(function(meal) {
    var sub = meal.subtotal || {};
    sumCalories += Number(sub.calorias || 0);
    sumProtein += Number(sub.proteinas || 0);
    sumCarbs += Number(sub.carboidratos || 0);
    sumFat += Number(sub.gorduras || 0);

    (meal.itens || []).forEach(function(item) {
      if (!item.source) {
        issues.push('[' + (meal.nome || meal.tipo) + '] "' + item.nome + '" has no source');
      }
      ['calorias', 'proteinas', 'carboidratos', 'gorduras'].forEach(function(key) {
        var val = Number(item[key]);
        if (!Number.isFinite(val) || val < 0) {
          issues.push('[' + (meal.nome || meal.tipo) + '] "' + item.nome + '" invalid ' + key + ': ' + item[key]);
        }
      });
    });
  });

  var planTotals = plan.resumoDiario || {};
  var calDiff = Math.abs(sumCalories - Number(planTotals.calorias || 0));
  var protDiff = Math.abs(sumProtein - Number(planTotals.proteinas || 0));

  if (calDiff > 10) {
    issues.push('calories mismatch: plan total ' + Math.round(planTotals.calorias) + ' vs meal sum ' + Math.round(sumCalories));
  }
  if (protDiff > 3) {
    issues.push('protein mismatch: plan total ' + Math.round(planTotals.proteinas) + ' vs meal sum ' + Math.round(sumProtein));
  }

  return issues;
}

module.exports = {
  FOOD_RANGES: FOOD_RANGES,
  validateFoodItem: validateFoodItem,
  validateMeal: validateMeal,
  validatePlan: validatePlan,
  repairFoodItem: repairFoodItem,
  assertPlanIntegrity: assertPlanIntegrity,
  getMacros100g: getMacros100g,
  matchCategory: matchCategory,
  normalizeText: normalizeText
};
