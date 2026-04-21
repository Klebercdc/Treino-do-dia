'use strict';

function safe(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function pickString() {
  for (var i = 0; i < arguments.length; i += 1) {
    var v = arguments[i];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber() {
  for (var i = 0; i < arguments.length; i += 1) {
    var n = Number(arguments[i]);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Extracts training frequency, volume, fatigue, recovery and adherence
 * from any payload shape. Canonical source for sports/training signals.
 */
function buildTrainingContext(input) {
  var raw = safe(input);
  var context = safe(raw.context);
  var profile = safe(raw.profile);
  var intakeSnapshot = safe(raw.intakeSnapshot || context.intakeSnapshot);
  var intakeTraining = safe(intakeSnapshot.treino);
  var adherence = safe(raw.aderencia || raw.adherenceContext || context.aderencia || context.adherenceContext || intakeSnapshot.aderencia);
  var training = safe(
    raw.contextoTreino ||
    raw.trainingContext ||
    raw.trainingSnapshot ||
    context.contextoTreino ||
    context.trainingContext ||
    context.trainingSnapshot ||
    profile.contextoTreino ||
    intakeTraining
  );

  return {
    frequencia: pickString(training.frequencia, training.frequency, intakeTraining.frequencia),
    duracao: pickString(training.duracao, training.duration),
    tipo: pickString(training.tipo, training.type),
    fadiga: pickNumber(training.fadiga, training.fatigue, adherence.fadiga, intakeTraining.fadiga),
    tendenciaForca: pickString(training.tendenciaForca, training.strengthTrend, adherence.tendenciaForca, intakeTraining.tendenciaForca),
    prioridadeMetabolica: pickString(training.prioridadeMetabolica, training.priority, adherence.prioridadeMetabolica, intakeTraining.prioridadeMetabolica),
  };
}

/**
 * Extracts adherence/recovery overlay: adjustment mode, practicality,
 * NEAT, fatigue, strength trend, metabolic priority and training schedule.
 */
function buildAdherenceContext(input) {
  var raw = safe(input);
  var context = safe(raw.context);
  var profile = safe(raw.profile);
  var intakeSnapshot = safe(raw.intakeSnapshot || context.intakeSnapshot);
  var intakeTraining = safe(intakeSnapshot.treino);
  var adherence = safe(raw.aderencia || raw.adherenceContext || context.aderencia || context.adherenceContext || intakeSnapshot.aderencia);
  var training = safe(
    raw.contextoTreino || raw.trainingContext || raw.trainingSnapshot ||
    context.contextoTreino || context.trainingContext || profile.contextoTreino || intakeTraining
  );

  return {
    modoAjuste: pickString(adherence.modoAjuste, adherence.adjustmentMode),
    praticidade: pickString(adherence.praticidade, adherence.practicality),
    neat: pickString(adherence.neat),
    fadiga: pickNumber(adherence.fadiga, training.fadiga, training.fatigue, intakeTraining.fadiga),
    tendenciaForca: pickString(adherence.tendenciaForca, training.tendenciaForca, training.strengthTrend, intakeTraining.tendenciaForca),
    prioridadeMetabolica: pickString(adherence.prioridadeMetabolica, training.prioridadeMetabolica, training.priority, intakeTraining.prioridadeMetabolica),
    horarioTreino: pickString(adherence.horarioTreino, intakeTraining.periodo),
  };
}

module.exports = {
  buildTrainingContext: buildTrainingContext,
  buildAdherenceContext: buildAdherenceContext,
};
