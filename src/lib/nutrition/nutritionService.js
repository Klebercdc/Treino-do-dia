'use strict';

var premiumCatalog = require('./premiumCatalog');
var tacoService = require('./tacoService');
var foodSearchService = require('./foodSearchService');
var adaptiveNutrition = require('./adaptiveNutrition');
var clinical = require('../../core/nutrition/diet_context_clinical');
var strategyEngine = require('../../core/nutrition/diet_strategy_engine');
var renderer = require('../../core/nutrition/diet_prescription_renderer');

module.exports = {
  ACTIVITY_FACTORS: strategyEngine.ACTIVITY_FACTORS,
  FOOD_LIBRARY: renderer.FOOD_LIBRARY,
  CANONICAL_FOODS: premiumCatalog.CANONICAL_FOODS,
  RECIPE_CATALOG: premiumCatalog.RECIPE_CATALOG,
  DIET_TEMPLATES: renderer.DIET_TEMPLATES,
  TACO_DATABASE: tacoService.TACO_DATABASE,

  buildNutritionProfile: strategyEngine.buildNutritionProfile,
  buildUnifiedNutritionContext: strategyEngine.buildUnifiedNutritionContext,

  buildNutritionStrategy: strategyEngine.buildNutritionStrategy,
  calculateNutrition: strategyEngine.calculateNutrition,

  buildNutritionPrescription: renderer.buildNutritionPrescription,
  generateNutritionPlan: renderer.generateNutritionPlan,
  selectDietTemplate: renderer.selectDietTemplate,
  generateDietFromTemplate: renderer.generateDietFromTemplate,
  substituteFood: renderer.substituteFood,
  rebalanceDiet: renderer.rebalanceDiet,
  normalizeDietItem: renderer.normalizeDietItem,

  normalizeText: tacoService.normalizeText,
  getAllTacoFoods: tacoService.getAllTacoFoods,
  getTacoFoodById: tacoService.getTacoFoodById,
  getTacoFoodByCode: tacoService.getTacoFoodByCode,
  searchTacoFoods: tacoService.searchTacoFoods,
  getTacoFoodsByCategory: tacoService.getTacoFoodsByCategory,
  mapTacoFoodToKroniaMacros: tacoService.mapTacoFoodToKroniaMacros,
  estimateNutritionFromTaco: tacoService.estimateNutritionFromTaco,
  findBestTacoMatch: tacoService.findBestTacoMatch,
  TACO_FOOD_UX_OVERRIDES: tacoService.TACO_FOOD_UX_OVERRIDES,
  classifyTacoFoodGroup: tacoService.classifyTacoFoodGroup,
  applyTacoFoodUx: tacoService.applyTacoFoodUx,
  findNutritionFood: foodSearchService.findNutritionFood,
  searchNutritionFoods: foodSearchService.searchNutritionFoods,
  NUTRITION_MEMORY_KEY: adaptiveNutrition.NUTRITION_MEMORY_KEY,
  DEFAULT_NUTRITION_MEMORY: adaptiveNutrition.DEFAULT_NUTRITION_MEMORY,
  normalizeNutritionMemory: adaptiveNutrition.normalizeMemory,
  readNutritionMemory: adaptiveNutrition.readNutritionMemory,
  saveNutritionMemory: adaptiveNutrition.saveNutritionMemory,
  updateNutritionMemory: adaptiveNutrition.updateNutritionMemory,
  resetNutritionMemory: adaptiveNutrition.resetNutritionMemory,
  calculateNutritionPersonalizationScore: adaptiveNutrition.calculateNutritionPersonalizationScore,
  selectAdaptiveDietTemplate: adaptiveNutrition.selectAdaptiveDietTemplate,
  registerDailyNutritionFeedback: adaptiveNutrition.registerDailyNutritionFeedback,
  suggestDietAdaptations: adaptiveNutrition.suggestDietAdaptations,
  runWeeklyNutritionCheckin: adaptiveNutrition.runWeeklyNutritionCheckin,

  resolveDietMode: clinical.resolveDietMode,
  applyClinicalRules: clinical.applyClinicalRules,
  applyMedicalAdjustments: clinical.applyMedicalAdjustments,
  buildLabContext: clinical.buildLabContext,

  round: clinical.round
};
