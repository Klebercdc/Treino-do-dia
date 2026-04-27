'use strict';

var STEPS = {
  BODY_COMPOSITION: 1,
  GOAL: 2,
  HEALTH_EXAMS: 3,
  FOOD: 4,
  TRAINING: 5,
  METABOLISM: 6,
};

var TOTAL_STEPS = 6;

var STEP_KEYS = {
  1: 'bodyComposition',
  2: 'goal',
  3: 'healthExams',
  4: 'food',
  5: 'training',
  6: 'metabolism',
};

function startDietFlow(userId) {
  return {
    userId: userId,
    currentStep: STEPS.BODY_COMPOSITION,
    totalSteps: TOTAL_STEPS,
    completedSteps: [],
    data: {},
    startedAt: new Date().toISOString(),
  };
}

function continueDietFlow(flowState, stepNumber, stepData) {
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 6) {
    throw new Error('stepNumber deve ser inteiro entre 1 e 6');
  }
  if (stepNumber !== flowState.currentStep) {
    throw new Error('stepNumber ' + stepNumber + ' não corresponde ao currentStep ' + flowState.currentStep);
  }

  var key = STEP_KEYS[stepNumber];
  var updated = Object.assign({}, flowState);
  updated.data = Object.assign({}, flowState.data);
  updated.data[key] = stepData;

  var completed = flowState.completedSteps.slice();
  if (completed.indexOf(stepNumber) === -1) {
    completed.push(stepNumber);
  }
  updated.completedSteps = completed;

  if (stepNumber < TOTAL_STEPS) {
    updated.currentStep = stepNumber + 1;
  } else {
    updated.completedAt = new Date().toISOString();
  }

  return updated;
}

function isFlowComplete(flowState) {
  return flowState && flowState.completedSteps && flowState.completedSteps.length === TOTAL_STEPS;
}

function getFlowProgress(flowState) {
  var completed = flowState && flowState.completedSteps ? flowState.completedSteps.length : 0;
  return {
    current: flowState ? flowState.currentStep : 1,
    total: TOTAL_STEPS,
    percent: Math.round((completed / TOTAL_STEPS) * 100),
  };
}

function validateStepData(stepNumber, data) {
  var errors = [];
  if (stepNumber === 1) {
    if (!data || data.weight_kg == null) errors.push('weight_kg obrigatório');
    if (!data || data.height_cm == null) errors.push('height_cm obrigatório');
  } else if (stepNumber === 2) {
    if (!data || !data.objective) errors.push('objective obrigatório');
  }
  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  STEPS: STEPS,
  TOTAL_STEPS: TOTAL_STEPS,
  STEP_KEYS: STEP_KEYS,
  startDietFlow: startDietFlow,
  continueDietFlow: continueDietFlow,
  isFlowComplete: isFlowComplete,
  getFlowProgress: getFlowProgress,
  validateStepData: validateStepData,
};
