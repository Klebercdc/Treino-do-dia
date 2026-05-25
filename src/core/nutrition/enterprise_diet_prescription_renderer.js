'use strict';

var baseRenderer = require('./diet_prescription_renderer');
var strategyEngine = require('./diet_strategy_engine');
var adaptiveNutrition = require('../../lib/nutrition/adaptiveNutrition');

function resolveMemory(input) {
  if (!input || typeof input !== 'object') return adaptiveNutrition.normalizeMemory();
  return adaptiveNutrition.normalizeMemory(
    input.nutritionMemory
    || input.adaptiveMemory
    || input.memory
    || input.userNutritionMemory
  );
}

function enrichEnterpriseResult(result, profileInput) {
  if (!result || typeof result !== 'object') return result;

  var profile = result.profile || profileInput || {};
  var memory = resolveMemory(profileInput || profile);
  var personalization = adaptiveNutrition.calculateNutritionPersonalizationScore(profile, memory);
  var suggestions = adaptiveNutrition.suggestDietAdaptations(result.plan || result, memory, profile);

  result.enterpriseAi = {
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
    recommendations: suggestions,
    generated_at: new Date().toISOString()
  };

  if (result.plan && typeof result.plan === 'object') {
    result.plan.enterpriseAi = result.enterpriseAi;
  }

  return result;
}

function buildNutritionPrescription(strategy, options) {
  var result = baseRenderer.buildNutritionPrescription(strategy);
  return enrichEnterpriseResult(result, (options && options.profileInput) || (strategy && strategy.profile) || {});
}

function generateNutritionPlan(profileInput) {
  var strategy = strategyEngine.calculateNutrition(profileInput || {});
  return buildNutritionPrescription(strategy, { profileInput: profileInput || {} });
}

function renderPrescription(strategy) {
  return buildNutritionPrescription(strategy);
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
