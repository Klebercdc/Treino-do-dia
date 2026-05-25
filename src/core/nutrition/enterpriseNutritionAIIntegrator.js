'use strict';

var userFoodMemory = require('./userFoodMemory');
var mealDiversityEngine = require('./mealDiversityEngine');
var adherenceEngine = require('./adherenceEngine');
var behaviorEngine = require('./behaviorEngine');
var recommendationEngine = require('./recommendationEngine');
var adaptiveStrategyEngine = require('./adaptiveStrategyEngine');

function buildAdaptiveBadges(plan) {
  var badges = ['AI Adaptive'];
  if (plan && plan.adherence && plan.adherence.score >= 80) badges.push('High Adherence');
  if (plan && plan.diversityScore >= 80) badges.push('High Diversity');
  if (plan && plan.adaptiveStrategy && plan.adaptiveStrategy.modifiers && plan.adaptiveStrategy.modifiers.length) badges.push('Behavior Aware');
  return badges;
}

function buildAdaptiveRecommendations(plan, profile) {
  var mealRecommendations = [];
  (plan.refeicoes || []).forEach(function(meal) {
    mealRecommendations = mealRecommendations.concat(recommendationEngine.recommendMealSubstitutions(meal));
  });

  return {
    meals: Array.from(new Set(mealRecommendations)).slice(0, 6),
    timing: recommendationEngine.recommendBetterTiming(plan),
    hydration: recommendationEngine.recommendHydrationAdjustments(profile || {}),
    satiety: recommendationEngine.recommendSatietyAdjustments(plan),
    proteinDistribution: recommendationEngine.recommendProteinDistribution(plan),
    behavior: recommendationEngine.recommendBehavioralAdjustments(profile || {})
  };
}

function applyEnterpriseNutritionAI(plan, profile, options) {
  if (!plan) return plan;

  var settings = options || {};
  var history = settings.history || [];
  var seedMemory = settings.memory || (profile && profile.foodMemory) || {};
  var memory = userFoodMemory.loadUserFoodMemory(profile && (profile.userId || profile.id), seedMemory);
  var preferenceProfile = userFoodMemory.buildFoodPreferenceProfile(memory);
  var behaviorProfile = behaviorEngine.buildBehaviorProfile(profile || {});

  var adaptedPlan = mealDiversityEngine.diversifyPlan(plan, history);
  adaptedPlan.diversityScore = mealDiversityEngine.calculateMealDiversity(adaptedPlan, history);
  adaptedPlan = adherenceEngine.adaptPlanForAdherence(adaptedPlan, Object.assign({}, profile || {}, { foodMemory: memory }));

  var adaptiveStrategy = adaptiveStrategyEngine.buildAdaptiveStrategy(
    profile || {},
    behaviorProfile.eatingBehavior,
    adaptedPlan.adherence,
    memory,
    settings.progress || {}
  );

  adaptedPlan.behaviorProfile = behaviorProfile;
  adaptedPlan.foodMemoryProfile = preferenceProfile;
  adaptedPlan.adaptiveStrategy = adaptiveStrategy;
  adaptedPlan.adaptiveRecommendations = buildAdaptiveRecommendations(adaptedPlan, profile || {});
  adaptedPlan.adaptiveBadges = buildAdaptiveBadges(adaptedPlan);
  adaptedPlan.enterpriseAI = {
    adaptive: true,
    behaviorAware: true,
    adherenceAware: true,
    diversityOptimized: true,
    recommendationAware: true,
    tier: 'Adaptive Enterprise Nutrition AI'
  };

  adaptedPlan.enterpriseAISummary = {
    strategy: adaptiveStrategy.strategy,
    modifiers: adaptiveStrategy.modifiers,
    adherenceScore: adaptedPlan.adherence ? adaptedPlan.adherence.score : null,
    diversityScore: adaptedPlan.diversityScore,
    badges: adaptedPlan.adaptiveBadges,
    pdfFooter: 'Plano adaptativo gerado pela IA do KroniA baseado em comportamento alimentar, aderência e preferência nutricional.'
  };

  adaptedPlan.premiumValidation = Object.assign({}, adaptedPlan.premiumValidation || {}, {
    tier: 'Adaptive Enterprise Nutrition AI',
    adaptiveAI: true,
    behaviorAware: true,
    adherenceAware: true,
    diversityOptimized: true
  });

  return adaptedPlan;
}

module.exports = {
  applyEnterpriseNutritionAI: applyEnterpriseNutritionAI,
  buildAdaptiveBadges: buildAdaptiveBadges,
  buildAdaptiveRecommendations: buildAdaptiveRecommendations
};
