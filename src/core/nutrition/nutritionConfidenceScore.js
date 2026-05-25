'use strict';

function isNaNOrUndefined(value) {
  return value === undefined || value === null || (typeof value === 'number' && isNaN(value));
}

function clamp(score) {
  return Math.max(0, Math.min(100, Math.round(Number(score || 0))));
}

function scoreFoodConfidence(item) {
  if (!item) return 0;
  var score = 100;

  if (!item.source) score -= 20;
  if (item.semanticStatus === 'flagged') score -= 20;
  if (item.source && /estimativa_/i.test(item.source)) score -= 10;

  var proteinas = item.proteinas != null ? item.proteinas : item.protein;
  var carboidratos = item.carboidratos != null ? item.carboidratos : item.carbs;
  var gorduras = item.gorduras != null ? item.gorduras : item.fat;
  var calorias = item.calorias != null ? item.calorias : item.calories;

  if (isNaNOrUndefined(proteinas) || isNaNOrUndefined(carboidratos) || isNaNOrUndefined(gorduras) || isNaNOrUndefined(calorias)) {
    score -= 35;
  } else {
    var expectedKcal = (Number(proteinas) * 4 + Number(carboidratos) * 4 + Number(gorduras) * 9);
    var actualKcal = Number(calorias);
    if (expectedKcal > 0 && Math.abs(actualKcal - expectedKcal) / expectedKcal > 0.35) score -= 15;
  }

  var portionLabel = String(item.porcao || item.portionLabel || '');
  if (!/\d+\s*g\b/.test(portionLabel) && !/\d+\s*ml\b/.test(portionLabel)) score -= 15;

  return clamp(score);
}

function scoreMealConfidence(meal) {
  if (!meal) return 0;
  var items = Array.isArray(meal.itens) ? meal.itens : [];
  if (!items.length) return 0;
  return clamp(items.reduce(function(acc, item) { return acc + scoreFoodConfidence(item); }, 0) / items.length);
}

function scoreSemanticConfidence(plan) {
  var meals = Array.isArray(plan && plan.refeicoes) ? plan.refeicoes : [];
  var items = [];
  meals.forEach(function(meal) { (meal.itens || []).forEach(function(item) { items.push(item); }); });
  if (!items.length) return 0;
  var valid = items.filter(function(item) { return item && item.semanticStatus && item.semanticStatus !== 'flagged'; }).length;
  return clamp((valid / items.length) * 100);
}

function scoreAdherenceConfidence(plan) {
  if (!plan || !plan.adherence) return 80;
  return clamp(plan.adherence.score || 80);
}

function scoreDiversityConfidence(plan) {
  if (!plan) return 80;
  if (typeof plan.diversityScore === 'number') return clamp(plan.diversityScore);
  var scores = (plan.refeicoes || []).map(function(meal) { return Number(meal.diversityScore || 85); });
  if (!scores.length) return 80;
  return clamp(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);
}

function scoreBehavioralConfidence(plan) {
  if (!plan || !plan.behaviorProfile) return 80;
  var score = 85;
  if (plan.behaviorProfile.eatingBehavior && plan.behaviorProfile.eatingBehavior.repeatedMealSignals) score -= 5;
  if (plan.adaptiveStrategy && plan.adaptiveStrategy.modifiers && plan.adaptiveStrategy.modifiers.length) score += 5;
  return clamp(score);
}

function scorePlanConfidence(plan) {
  if (!plan) return { score: 0, level: 'low', reasons: ['plano nulo'], riskyItems: [] };

  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var allItems = [];
  meals.forEach(function(meal) { (meal.itens || []).forEach(function(item) { if (item) allItems.push(item); }); });

  if (!allItems.length) return { score: 0, level: 'low', reasons: ['plano sem alimentos'], riskyItems: [] };

  var reasons = [];
  var riskyItems = [];
  var itemScores = allItems.map(function(item) {
    var itemScore = scoreFoodConfidence(item);
    if (itemScore < 80) riskyItems.push({ nome: item.nome || item.name || '?', score: itemScore, semanticStatus: item.semanticStatus || 'unknown' });
    return itemScore;
  });

  var foodConfidence = clamp(itemScores.reduce(function(a, b) { return a + b; }, 0) / itemScores.length);
  var semanticConfidence = scoreSemanticConfidence(plan);
  var adherenceConfidence = scoreAdherenceConfidence(plan);
  var diversityConfidence = scoreDiversityConfidence(plan);
  var behavioralConfidence = scoreBehavioralConfidence(plan);

  var score = clamp(
    foodConfidence * 0.45 +
    semanticConfidence * 0.25 +
    adherenceConfidence * 0.10 +
    diversityConfidence * 0.10 +
    behavioralConfidence * 0.10
  );

  var hasNaNMacros = allItems.some(function(item) {
    var p = item.proteinas != null ? item.proteinas : item.protein;
    var c = item.carboidratos != null ? item.carboidratos : item.carbs;
    var f = item.gorduras != null ? item.gorduras : item.fat;
    var cal = item.calorias != null ? item.calorias : item.calories;
    return isNaNOrUndefined(p) || isNaNOrUndefined(c) || isNaNOrUndefined(f) || isNaNOrUndefined(cal);
  });
  if (hasNaNMacros) {
    score = Math.min(score, 65);
    reasons.push('Macros NaN ou undefined detectados — plano não confiável');
  }

  if (foodConfidence < 85) reasons.push('foodConfidence abaixo do ideal: ' + foodConfidence);
  if (semanticConfidence < 90) reasons.push('semanticConfidence abaixo do ideal: ' + semanticConfidence);
  if (adherenceConfidence < 75) reasons.push('adherenceConfidence baixa: ' + adherenceConfidence);
  if (diversityConfidence < 75) reasons.push('diversityConfidence baixa: ' + diversityConfidence);

  return {
    score: score,
    level: score >= 85 ? 'high' : (score >= 70 ? 'medium' : 'low'),
    foodConfidence: foodConfidence,
    semanticConfidence: semanticConfidence,
    adherenceConfidence: adherenceConfidence,
    diversityConfidence: diversityConfidence,
    behavioralConfidence: behavioralConfidence,
    reasons: reasons,
    riskyItems: riskyItems.slice(0, 5)
  };
}

module.exports = {
  scoreFoodConfidence: scoreFoodConfidence,
  scoreMealConfidence: scoreMealConfidence,
  scorePlanConfidence: scorePlanConfidence,
  scoreSemanticConfidence: scoreSemanticConfidence,
  scoreAdherenceConfidence: scoreAdherenceConfidence,
  scoreDiversityConfidence: scoreDiversityConfidence,
  scoreBehavioralConfidence: scoreBehavioralConfidence
};
