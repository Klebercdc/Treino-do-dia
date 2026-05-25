'use strict';

var baseRenderer = require('./diet_prescription_renderer');
var enterprisePipeline = require('./applyEnterprisePipeline');
var premiumCatalog = require('../../lib/nutrition/premiumCatalog');

function enhanceResult(result) {
  if (!result || !result.plan) return result;

  var catalog = premiumCatalog.buildPremiumFoodLibrary();
  var enhancedPlan = enterprisePipeline.applyEnterprisePipeline(
    result.plan,
    result.profile || {},
    {
      catalog: catalog,
      history: result.profile && result.profile.dietHistory || [],
      memory: result.profile && result.profile.foodMemory || {},
      progress: result.profile && result.profile.progress || {}
    }
  );

  return Object.assign({}, result, {
    plan: enhancedPlan,
    enterpriseAI: enhancedPlan.enterpriseAI,
    enterpriseAISummary: enhancedPlan.enterpriseAISummary,
    adaptiveBadges: enhancedPlan.adaptiveBadges,
    adaptiveStrategy: enhancedPlan.adaptiveStrategy,
    adaptiveRecommendations: enhancedPlan.adaptiveRecommendations,
    nutritionConfidence: enhancedPlan.confidence || enhancedPlan.nutritionConfidence,
    nutritionAuditTrail: enhancedPlan.auditSummary || enhancedPlan.nutritionAuditTrail,
    visualPrescription: Object.assign({}, result.visualPrescription || {}, {
      enterpriseAI: enhancedPlan.enterpriseAI,
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
