'use strict';

var assert = require('assert');
var integrator = require('../../src/core/nutrition/enterpriseNutritionAIIntegrator');

function buildMockPlan() {
  return {
    refeicoes: [
      {
        nome: 'Café da manhã',
        itens: [
          {
            nome: 'Iogurte proteico natural',
            calorias: 130,
            proteinas: 17,
            carboidratos: 6,
            gorduras: 4,
            semanticStatus: 'valid',
            source: 'USDA'
          }
        ]
      }
    ]
  };
}

(function run() {
  var plan = buildMockPlan();

  var result = integrator.applyEnterpriseNutritionAI(plan, {
    objetivo: 'hipertrofia',
    trainingTime: 'night',
    workShift: 'night',
    hungerLevel: 8,
    snacksPerDay: 3,
    cravings: ['sweet']
  }, {
    history: []
  });

  assert(result.enterpriseAI);
  assert(result.enterpriseAI.adaptive === true);
  assert(Array.isArray(result.adaptiveBadges));
  assert(result.adaptiveBadges.length >= 1);
  assert(result.enterpriseAISummary);
  assert(result.adaptiveRecommendations);
  assert(result.behaviorProfile);
  assert(result.adaptiveStrategy);

  console.log('enterprise-ai-integrator.test.js passed');
})();
