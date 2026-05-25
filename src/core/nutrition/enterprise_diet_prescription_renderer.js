'use strict';

var baseRenderer = require('./diet_prescription_renderer');
var enterprisePipeline = require('./applyEnterprisePipeline');
var premiumCatalog = require('../../lib/nutrition/premiumCatalog');
var adaptiveNutrition = require('../../lib/nutrition/adaptiveNutrition');

function resolveMemory(input) {
  if (!input || typeof input !== 'object') return adaptiveNutrition.normalizeMemory();
  return adaptiveNutrition.normalizeMemory(
    input.nutritionMemory
    || input.adaptiveMemory
    || input.memory
    || input.userNutritionMemory
    || input.foodMemory
  );
}

function buildEnterpriseAiContract(result, profile, enhancedPlan) {
  var memory = resolveMemory(profile || {});
  var personalization = adaptiveNutrition.calculateNutritionPersonalizationScore(profile || {}, memory);
  var recommendations = adaptiveNutrition.suggestDietAdaptations(enhancedPlan || result.plan || result, memory, profile || {});

  return {
    enabled: true,
    renderer: 'enterprise_diet_prescription_renderer',
    adaptive_ai: true,
    behavior_engine: true,
    adherence_engine: true,
    diversity_engine: true,
    recommendation_engine: true,
    food_memory_engine: true,
    adaptive_strategy_engine: true,
    personalization: personalization,
    memory: memory,
    recommendations: recommendations,
    generated_at: new Date().toISOString()
  };
}

function enhanceResult(result) {
  if (!result || !result.plan) return result;

  var profile = result.profile || {};
  var catalog = premiumCatalog.buildPremiumFoodLibrary();
  var enhancedPlan = enterprisePipeline.applyEnterprisePipeline(
    result.plan,
    profile,
    {
      catalog: catalog,
      history: profile.dietHistory || [],
      memory: profile.foodMemory || profile.nutritionMemory || {},
      progress: profile.progress || {}
    }
  );

  var enterpriseAi = buildEnterpriseAiContract(result, profile, enhancedPlan);
  enhancedPlan.enterpriseAi = enterpriseAi;

  return Object.assign({}, result, {
    plan: enhancedPlan,
    enterpriseAI: enhancedPlan.enterpriseAI,
    enterpriseAi: enterpriseAi,
    enterpriseAISummary: enhancedPlan.enterpriseAISummary,
    adaptiveBadges: enhancedPlan.adaptiveBadges,
    adaptiveStrategy: enhancedPlan.adaptiveStrategy,
    adaptiveRecommendations: enhancedPlan.adaptiveRecommendations,
    nutritionConfidence: enhancedPlan.confidence || enhancedPlan.nutritionConfidence,
    nutritionAuditTrail: enhancedPlan.auditSummary || enhancedPlan.nutritionAuditTrail,
    visualPrescription: Object.assign({}, result.visualPrescription || {}, {
      enterpriseAI: enhancedPlan.enterpriseAI,
      enterpriseAi: enterpriseAi,
      enterpriseAISummary: enhancedPlan.enterpriseAISummary,
      adaptiveBadges: enhancedPlan.adaptiveBadges,
      adaptiveRecommendations: enhancedPlan.adaptiveRecommendations
    })
  });
}

function buildNutritionPrescription(strategy) {
  return enhanceResult(baseRenderer.buildNutritionPrescription(strategy));
}

function generateNutritionPlan(profileInput) {
  return enhanceResult(baseRenderer.generateNutritionPlan(profileInput));
}

function renderPrescription(strategy) {
  return enhanceResult(baseRenderer.renderPrescription(strategy));
}

function generatePlan(profileInput) {
  return generateNutritionPlan(profileInput);
}

module.exports = Object.assign({}, baseRenderer, {
  buildNutritionPrescription: buildNutritionPrescription,
  generateNutritionPlan: generateNutritionPlan,
  renderPrescription: renderPrescription,
  generatePlan: generatePlan
});
