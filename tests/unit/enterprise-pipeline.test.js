'use strict';

var assert = require('assert');
var pipeline = require('../../src/core/nutrition/applyEnterprisePipeline');

(function run() {
  var plan = {
    refeicoes: [
      {
        nome: 'Café da manhã',
        itens: [
          {
            nome: 'Iogurte natural',
            calorias: 130,
            proteinas: 17,
            carboidratos: 6,
            gorduras: 4,
            source: 'USDA'
          }
        ]
      }
    ]
  };

  var result = pipeline.applyEnterprisePipeline(plan, {
    objetivo: 'hipertrofia',
    workShift: 'night',
    hungerLevel: 8,
    snacksPerDay: 3,
    cravings: ['sweet']
  }, {
    history: []
  });

  assert(result.productionReady === true);
  assert(result.enterpriseAI);
  assert(result.auditTrail);
  assert(result.auditSummary);
  assert(result.confidence);
  assert(result.adaptiveBadges);
  assert(result.adaptiveStrategy);
  assert(result.confidence.level !== 'low');

  console.log('enterprise-pipeline.test.js passed');
})();
