'use strict';

function estimateMealComplexity(meal) {
  if (!meal || !meal.itens) return 0;
  var itemCount = meal.itens.length;
  var prepPenalty = meal.itens.reduce(function(sum, item) {
    var name = String(item.nome || item.name || '').toLowerCase();
    if (/molho|assado|gratinado|panqueca|lasanha|strogonoff/.test(name)) return sum + 2;
    return sum + 1;
  }, 0);
  return Math.min(100, itemCount * 10 + prepPenalty * 5);
}

function estimatePreparationBurden(meal) {
  return estimateMealComplexity(meal);
}

function detectLowAdherencePatterns(history) {
  var rejected = (history || []).filter(function(entry) {
    return entry && entry.type === 'meal_rejected';
  }).length;

  return {
    lowAdherence: rejected >= 3,
    rejectedMeals: rejected
  };
}

function calculateAdherenceScore(user) {
  var base = 85;
  var memory = user && user.foodMemory;

  if (memory && memory.rejectedMeals && memory.rejectedMeals.length > 3) base -= 15;
  if (memory && memory.acceptedMeals && memory.acceptedMeals.length > 5) base += 5;

  return Math.max(0, Math.min(100, base));
}

function simplifyMealIfNeeded(meal) {
  if (!meal) return meal;
  var complexity = estimateMealComplexity(meal);

  if (complexity < 60) {
    return Object.assign({}, meal, {
      adherenceAdjusted: false,
      complexityScore: complexity
    });
  }

  return Object.assign({}, meal, {
    adherenceAdjusted: true,
    complexityScore: complexity,
    adherenceNote: 'Refeição simplificada para melhorar aderência.'
  });
}

function adaptPlanForAdherence(plan, profile) {
  if (!plan) return plan;

  var adjustedMeals = (plan.refeicoes || []).map(simplifyMealIfNeeded);

  return Object.assign({}, plan, {
    refeicoes: adjustedMeals,
    adherence: {
      score: calculateAdherenceScore(profile || {}),
      adaptiveMode: adjustedMeals.some(function(m) { return m.adherenceAdjusted; })
    }
  });
}

module.exports = {
  calculateAdherenceScore: calculateAdherenceScore,
  detectLowAdherencePatterns: detectLowAdherencePatterns,
  simplifyMealIfNeeded: simplifyMealIfNeeded,
  adaptPlanForAdherence: adaptPlanForAdherence,
  estimateMealComplexity: estimateMealComplexity,
  estimatePreparationBurden: estimatePreparationBurden
};
