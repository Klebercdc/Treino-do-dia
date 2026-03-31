const workoutService = require('../../services/workout/workoutService');
const dietService = require('../../services/diet/dietService');
const supplementService = require('../../services/supplement/supplementService');
const progressService = require('../../services/progress/progressService');
const billingService = require('../../services/billing/billingService');

async function executeDomainAction({ action, domain, payload }) {
  if (domain === 'workout') return workoutService.execute(action, payload);
  if (domain === 'diet') return dietService.execute(action, payload);
  if (domain === 'supplement') return supplementService.execute(action, payload);
  if (domain === 'progress') return progressService.execute(action, payload);
  if (domain === 'billing') return billingService.resolve({ action, payload });

  return {
    action: 'ASK_SINGLE_CLARIFICATION',
    domain: 'general',
    payload: { question: 'Qual fluxo você quer abrir: treino, dieta, suplementação ou progresso?' },
  };
}

module.exports = { executeDomainAction };
