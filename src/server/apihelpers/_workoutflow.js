/**
 * Fluxo de coleta de dados para treino — KRONOS
 * 6 perguntas objetivas que montam o perfil completo para a IA.
 */

var workoutBuilder = require('./_workoutBuilder');

var STEPS = [
  {
    key:      'objetivo',
    question: 'Qual o objetivo do treino? Ex.: hipertrofia, força, definição ou condicionamento.'
  },
  {
    key:      'nivel',
    question: 'Qual seu nível de experiência?\nEx.: iniciante (menos de 1 ano), intermediário (1-3 anos) ou avançado (+3 anos).'
  },
  {
    key:      'dias',
    question: 'Quantos dias por semana você consegue treinar?'
  },
  {
    key:      'tempo',
    question: 'Quanto tempo por sessão você tem disponível?\nEx.: 45 min, 1 hora, 1h30.'
  },
  {
    key:      'equipamentos',
    question: 'Onde você treina?\nEx.: academia completa, casa com halteres, casa sem equipamento, ao ar livre.'
  },
  {
    key:      'limitacoes',
    question: 'Tem alguma dor, lesão ou limitação física que eu deva respeitar?\nSe não tiver, responda "não".'
  }
];

function startWorkoutFlow() {
  return {
    mode:      'workout',
    stepIndex: 0,
    collected: {},
    response:  STEPS[0].question
  };
}

function continueWorkoutFlow(stepIndex, collected, message) {
  var step        = STEPS[stepIndex];
  var newCollected = {};

  Object.keys(collected || {}).forEach(function(k) { newCollected[k] = collected[k]; });
  newCollected[step.key] = String(message || '').trim();

  var nextIndex = stepIndex + 1;

  if (nextIndex >= STEPS.length) {
    return { finished: true, collected: newCollected };
  }

  return {
    finished:  false,
    mode:      'workout',
    stepIndex: nextIndex,
    collected: newCollected,
    response:  STEPS[nextIndex].question
  };
}

/**
 * Monta a mensagem de usuário que vai para a IA.
 * Usa o builder interno para gerar um plano estável e pede à IA para retorná-lo exatamente.
 * Elimina a dependência de a IA retornar JSON no formato correto.
 */
function buildWorkoutMessage(collected) {
  var safeCollected = collected || {};
  var prebuiltPlan = workoutBuilder.buildWorkoutPlan(safeCollected);
  return (
    'RETORNE EXATAMENTE O JSON ABAIXO. ' +
    'NÃO MODIFIQUE. ' +
    'NÃO ADICIONE TEXTO ANTES OU DEPOIS.\n' +
    JSON.stringify(prebuiltPlan)
  );
}

module.exports = {
  startWorkoutFlow:    startWorkoutFlow,
  continueWorkoutFlow: continueWorkoutFlow,
  buildWorkoutMessage: buildWorkoutMessage,
  STEPS:               STEPS
};
