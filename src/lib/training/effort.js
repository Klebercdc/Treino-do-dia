const {
  EFFORT_MODE,
  EXPERIENCE_MODE,
  KNOWLEDGE_LEVEL,
  TRAINING_LEVEL
} = require('../../types/domain');

const SIMPLE_EFFORT_TO_RPE = Object.freeze({
  MUITO_LEVE: 6,
  LEVE: 7,
  MODERADO: 8,
  DIFICIL: 9,
  NO_LIMITE: 10
});

const RIR_TO_RPE = Object.freeze({
  '4+': 6,
  '3': 7,
  '2': 8,
  '1': 9,
  '0': 10
});

function chooseEffortMode(profile) {
  if (profile.experienceMode === EXPERIENCE_MODE.SIMPLE) return EFFORT_MODE.SIMPLE_EFFORT_MODE;
  if (profile.knowledgeLevel === KNOWLEDGE_LEVEL.TECHNICAL) return EFFORT_MODE.ADVANCED_RPE_MODE;
  if (profile.trainingLevel === TRAINING_LEVEL.ATHLETE) return EFFORT_MODE.ADVANCED_RPE_MODE;
  return EFFORT_MODE.REPS_IN_RESERVE_MODE;
}

function simpleEffortToRpe(label) {
  const key = String(label || '').trim().toUpperCase();
  return SIMPLE_EFFORT_TO_RPE[key] ?? null;
}

function repsInReserveToRpe(rir) {
  const key = String(rir || '').trim();
  return RIR_TO_RPE[key] ?? null;
}

function validateEffortCoherence({ mode, reportedRpe, simpleEffortLabel, repsInReserve }) {
  let inferredRpe = null;

  if (mode === EFFORT_MODE.SIMPLE_EFFORT_MODE) inferredRpe = simpleEffortToRpe(simpleEffortLabel);
  if (mode === EFFORT_MODE.REPS_IN_RESERVE_MODE) inferredRpe = repsInReserveToRpe(repsInReserve);
  if (mode === EFFORT_MODE.ADVANCED_RPE_MODE) inferredRpe = Number(reportedRpe);

  if (!Number.isFinite(inferredRpe)) {
    return { valid: false, reason: 'Não foi possível inferir RPE a partir da entrada.' };
  }

  if (Number.isFinite(reportedRpe) && Math.abs(Number(reportedRpe) - inferredRpe) > 1) {
    return { valid: false, reason: 'Registro incoerente entre esforço informado e RPE.' };
  }

  return { valid: true, inferredRpe };
}

module.exports = {
  SIMPLE_EFFORT_TO_RPE,
  RIR_TO_RPE,
  chooseEffortMode,
  simpleEffortToRpe,
  repsInReserveToRpe,
  validateEffortCoherence
};
