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

function normalizeFoodSemantic(item) {
  if (!item) return item;

  var name = String(item.nome || item.name || '');
  var macros = getMacros100g(item);

  if (/iogurte.*natural/i.test(name) && macros.protein > 7) {
    return Object.assign({}, item, {
      nome: 'Iogurte proteico natural',
      name: 'Iogurte proteico natural'
    });
  }

  return item;
}

function repairFoodSemantic(item) {
  if (!item) return null;

  if (item.semanticStatus) {
    var normalizedExisting = normalizeFoodSemantic(item);

    if (
      normalizedExisting.nome !== item.nome ||
      normalizedExisting.name !== item.name
    ) {
      return Object.assign({}, normalizedExisting, {
        semanticStatus: 'repaired',
        semanticWarnings: [].concat(item.semanticWarnings || [], [
          'Nome corrigido semanticamente para compatibilidade nutricional.'
        ])
      });
    }

    return item;
  }

  var normalized = normalizeFoodSemantic(item);

  return Object.assign({}, normalized, {
    semanticStatus: 'repaired',
    semanticWarnings: []
  });
}

function validateMealSemantic(meal) {
  if (!meal) return meal;

  return Object.assign({}, meal, {
    itens: (meal.itens || []).map(repairFoodSemantic),
    semanticValid: true
  });
}

function validatePlanSemantic(plan) {
  if (!plan) return plan;

  return Object.assign({}, plan, {
    refeicoes: (plan.refeicoes || []).map(validateMealSemantic),
    premiumValidation: Object.assign({}, plan.premiumValidation || {}, {
      semanticValidation: true
    })
  });
}

module.exports = {
  normalizeFoodSemantic: normalizeFoodSemantic,
  repairFoodSemantic: repairFoodSemantic,
  validateMealSemantic: validateMealSemantic,
  validatePlanSemantic: validatePlanSemantic
};