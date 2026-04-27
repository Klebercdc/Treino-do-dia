/**
 * Fluxo de coleta de dados para dieta — KRONOS
 * Gerencia o estado da conversa passo a passo.
 * O estado é passado pelo cliente em cada requisição.
 */

var STEPS = [
  { key: 'objetivo',    question: 'Qual seu objetivo? Ex.: emagrecer, hipertrofia ou manter.' },
  { key: 'peso',        question: 'Qual seu peso atual em kg?' },
  { key: 'altura',      question: 'Qual sua altura em cm?' },
  { key: 'idade',       question: 'Qual sua idade?' },
  { key: 'sexo',        question: 'Qual seu sexo? Ex.: masculino ou feminino.' },
  { key: 'rotina',      question: 'Como é sua rotina? Ex.: sedentário, trabalho físico, academia, cardio.' },
  { key: 'restricoes',  question: 'Tem alguma restrição alimentar ou alimento que evita? (Se não tiver, responda "não".)' }
];

function startDietFlow() {
  return {
    mode:      'diet',
    stepIndex: 0,
    collected: {},
    response:  STEPS[0].question
  };
}

function continueDietFlow(stepIndex, collected, message) {
  var step        = STEPS[stepIndex];
  var newCollected = {};

  // Copia collected existente
  Object.keys(collected || {}).forEach(function(k) { newCollected[k] = collected[k]; });
  newCollected[step.key] = String(message || '').trim();

  var nextIndex = stepIndex + 1;

  if (nextIndex >= STEPS.length) {
    return { finished: true, collected: newCollected };
  }

  return {
    finished:   false,
    mode:       'diet',
    stepIndex:  nextIndex,
    collected:  newCollected,
    response:   STEPS[nextIndex].question
  };
}

function isFlowComplete(state) {
  return state && state.mode === 'diet' && STEPS.every(function(s) {
    return state.collected && state.collected[s.key];
  });
}

module.exports = {
  startDietFlow:    startDietFlow,
  continueDietFlow: continueDietFlow,
  isFlowComplete:   isFlowComplete,
  STEPS:            STEPS
};
