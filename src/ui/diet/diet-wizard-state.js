'use strict';

var DIET_WIZARD_STEPS = [
  { key: 'bodyComposition', label: 'Composição Corporal', step: 1 },
  { key: 'goal',            label: 'Objetivo',            step: 2 },
  { key: 'healthExams',     label: 'Saúde e Exames',      step: 3 },
  { key: 'food',            label: 'Alimentação',         step: 4 },
  { key: 'training',        label: 'Treino',              step: 5 },
  { key: 'metabolism',      label: 'Metabolismo',         step: 6 },
];

var DIET_WIZARD_TOTAL = 6;

function createDietWizardState(userId) {
  return {
    userId: userId || null,
    currentStep: 1,
    totalSteps: DIET_WIZARD_TOTAL,
    completedSteps: [],
    data: {},
    startedAt: new Date().toISOString(),
  };
}

function advanceDietWizardStep(state, stepNumber, stepData) {
  var updated = Object.assign({}, state);
  updated.data = Object.assign({}, state.data);
  var keyMap = { 1: 'bodyComposition', 2: 'goal', 3: 'healthExams', 4: 'food', 5: 'training', 6: 'metabolism' };
  updated.data[keyMap[stepNumber]] = stepData;
  var completed = (state.completedSteps || []).slice();
  if (completed.indexOf(stepNumber) === -1) completed.push(stepNumber);
  updated.completedSteps = completed;
  if (stepNumber < DIET_WIZARD_TOTAL) {
    updated.currentStep = stepNumber + 1;
  } else {
    updated.completedAt = new Date().toISOString();
  }
  return updated;
}

function isDietWizardComplete(state) {
  return state && state.completedSteps && state.completedSteps.length === DIET_WIZARD_TOTAL;
}

function getDietWizardProgress(state) {
  var completed = state && state.completedSteps ? state.completedSteps.length : 0;
  return {
    current: state ? state.currentStep : 1,
    total: DIET_WIZARD_TOTAL,
    percent: Math.round((completed / DIET_WIZARD_TOTAL) * 100),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DIET_WIZARD_STEPS: DIET_WIZARD_STEPS,
    DIET_WIZARD_TOTAL: DIET_WIZARD_TOTAL,
    createDietWizardState: createDietWizardState,
    advanceDietWizardStep: advanceDietWizardStep,
    isDietWizardComplete: isDietWizardComplete,
    getDietWizardProgress: getDietWizardProgress,
  };
}
