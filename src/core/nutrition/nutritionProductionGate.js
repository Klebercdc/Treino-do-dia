'use strict';

function isNaNOrInvalid(value) {
  return value === undefined || value === null ||
    (typeof value === 'number' && isNaN(value));
}

function containsProportionalEstimate(value) {
  if (typeof value !== 'string') return false;
  return /estimativa\s+proporcional/i.test(value);
}

function deepContainsProportionalEstimate(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 6) return false;
  if (!obj || typeof obj !== 'object') return containsProportionalEstimate(String(obj || ''));
  if (Array.isArray(obj)) {
    return obj.some(function(v) { return deepContainsProportionalEstimate(v, depth + 1); });
  }
  return Object.keys(obj).some(function(k) {
    return deepContainsProportionalEstimate(obj[k], depth + 1);
  });
}

function validateNutritionProductionReadiness(plan) {
  if (!plan) {
    return {
      ready: false,
      tier: 'Premium Production',
      blockers: ['plano nulo'],
      warnings: []
    };
  }

  var blockers = [];
  var warnings = [];

  // Blocker 1: semanticValidation deve ser true
  var semanticValidation = plan.premiumValidation && plan.premiumValidation.semanticValidation;
  if (semanticValidation !== true) {
    blockers.push('premiumValidation.semanticValidation !== true');
  }

  // Blocker 2: confidence score >= 70
  var confidenceScore = plan.nutritionConfidence && plan.nutritionConfidence.score;
  if (confidenceScore == null) {
    blockers.push('nutritionConfidence.score ausente');
  } else if (Number(confidenceScore) < 70) {
    blockers.push('confidence score < 70 (' + confidenceScore + ')');
  }

  // Blocker 3, 4, 5: verificar todos os alimentos
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var hasItemWithoutSource = false;
  var hasItemWithoutStatus = false;
  var hasItemFlagged = false;

  meals.forEach(function(meal) {
    if (!meal) return;
    var items = Array.isArray(meal.itens) ? meal.itens : [];
    items.forEach(function(item) {
      if (!item) return;
      if (!item.source) hasItemWithoutSource = true;
      if (!item.semanticStatus) hasItemWithoutStatus = true;
      if (item.semanticStatus === 'flagged') hasItemFlagged = true;
    });
  });

  if (hasItemWithoutSource) blockers.push('Alimento(s) sem campo source');
  if (hasItemWithoutStatus) blockers.push('Alimento(s) sem semanticStatus');
  if (hasItemFlagged) blockers.push('Alimento(s) com semanticStatus "flagged"');

  // Blocker 6: totais do plano batem com soma das refeições (tolerância 1 kcal)
  var resumo = plan.resumoDiario || {};
  var planTotalCal = Number(resumo.calorias || plan.caloriasMeta || 0);
  var summedCal = meals.reduce(function(acc, meal) {
    if (!meal || !meal.subtotal) return acc;
    return acc + Number(meal.subtotal.calorias || 0);
  }, 0);

  if (planTotalCal > 0 && summedCal > 0 && Math.abs(planTotalCal - summedCal) > 1) {
    blockers.push(
      'Totais inconsistentes: plano=' + planTotalCal + ' kcal, soma refeições=' + Math.round(summedCal) + ' kcal'
    );
  }

  // Blocker 7: NaN ou undefined nos campos de totais
  var macrosMeta = plan.macrosMeta || {};
  var totalFields = {
    'calorias': resumo.calorias,
    'proteinas': resumo.proteinas,
    'carboidratos': resumo.carboidratos,
    'gorduras': resumo.gorduras
  };
  Object.keys(totalFields).forEach(function(field) {
    if (isNaNOrInvalid(totalFields[field])) {
      blockers.push('Campo "' + field + '" do resumoDiario é NaN ou undefined');
    }
  });

  // Blocker 8: string "estimativa proporcional" em qualquer campo
  if (deepContainsProportionalEstimate(plan)) {
    blockers.push('Campo contém texto "estimativa proporcional"');
  }

  // Warnings (não bloqueadores)

  // Warning 1: confidence entre 70-84
  if (confidenceScore != null && Number(confidenceScore) >= 70 && Number(confidenceScore) < 85) {
    warnings.push('Confiança nutricional média (' + confidenceScore + '/100) — recomendado >= 85');
  }

  // Warning 2/3: items substituted ou repaired
  var hasSubstituted = false;
  var hasRepaired = false;
  meals.forEach(function(meal) {
    if (!meal) return;
    (meal.itens || []).forEach(function(item) {
      if (!item) return;
      if (item.semanticStatus === 'substituted') hasSubstituted = true;
      if (item.semanticStatus === 'repaired') hasRepaired = true;
    });
  });

  if (hasSubstituted) warnings.push('Alimento(s) substituído(s) automaticamente — verificar adequação');
  if (hasRepaired) warnings.push('Alimento(s) com dados ajustados semanticamente');

  // Warning 4: AI fallback
  var aiStrategy = plan.premiumValidation && plan.premiumValidation.aiStrategy;
  if (aiStrategy === 'fallback') {
    warnings.push('Estratégia AI usou fallback — plano gerado pelo motor local');
  }

  var ready = blockers.length === 0;

  return {
    ready: ready,
    tier: 'Premium Production',
    blockers: blockers,
    warnings: warnings
  };
}

module.exports = {
  validateNutritionProductionReadiness: validateNutritionProductionReadiness
};
