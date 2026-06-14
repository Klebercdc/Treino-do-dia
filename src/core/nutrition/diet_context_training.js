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
    var raw = arguments[i];
    if (raw === undefined || raw === null || raw === '') continue;
    var n = Number(String(raw).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickObject() {
  for (var i = 0; i < arguments.length; i += 1) {
    var v = arguments[i];
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) return v;
  }
  return {};
}

function normalizeTrainingSignals(raw, context, profile, health, intakeTraining) {
  var supabase = safe(raw.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot);
  var trainingRecovery = pickObject(
    raw.trainingRecovery,
    raw.trainingSnapshot,
    raw.kroniaTrainingSignals,
    context.trainingRecovery,
    context.trainingSnapshot,
    context.kroniaTrainingSignals,
    profile.trainingRecovery,
    profile.trainingSnapshot,
    supabase.trainingRecovery
  );
  var source = Object.keys(trainingRecovery).length ? trainingRecovery : pickObject(health.trainingRecovery, intakeTraining.trainingRecovery);
  if (!Object.keys(source).length) return {};

  var fatigue = safe(source.fatigue);
  return {
    trainingRecovery: source,
    kroniaTrainingSignals: source,
    loadState: source.loadState || null,
    avgRpe: pickNumber(source.avgRpe),
    effectiveSetsLast7Days: pickNumber(source.effectiveSetsLast7Days),
    totalSetsLast7Days: pickNumber(source.totalSetsLast7Days),
    totalSetsLast14Days: pickNumber(source.totalSetsLast14Days),
    lastWorkoutDate: source.lastWorkoutDate || null,
    daysSinceLastWorkout: pickNumber(source.daysSinceLastWorkout),
    totalTrainingDays: pickNumber(source.totalTrainingDays),
    recoveryScore: pickNumber(source.recoveryScore, source.readiness && source.readiness.score),
    recoveryStatus: source.recoveryStatus || source.readiness && source.readiness.level || null,
    readiness: source.readiness || null,
    recentPRCount: pickNumber(source.recentPRCount),
    recentPRs: Array.isArray(source.recentPRs) ? source.recentPRs : [],
    adaptations: Array.isArray(source.adaptations) ? source.adaptations : [],
    fatigueScore: pickNumber(fatigue.score, source.fadiga),
    fatigueNotes: fatigue.notas || null,
    strengthTrend: source.strengthTrend || source.tendenciaForca || null,
    needsDeload: source.needsDeload === true,
    needsRecoveryFuel: source.needsRecoveryFuel === true,
    needsProteinDistribution: source.needsProteinDistribution === true,
    carbohydrateStrategy: source.carbohydrateStrategy || null,
    trainingNotes: Array.isArray(source.trainingNotes) ? source.trainingNotes : [],
  };
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
  var health = safe(raw.saude || raw.healthContext || context.saude || context.healthContext);
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
  var signals = normalizeTrainingSignals(raw, context, profile, health, intakeTraining);

  return Object.assign({
    frequencia: pickString(training.frequencia, training.frequency, intakeTraining.frequencia),
    duracao: pickString(training.duracao, training.duration),
    tipo: pickString(training.tipo, training.type),
    fadiga: pickNumber(training.fadiga, training.fatigue, adherence.fadiga, intakeTraining.fadiga, signals.fatigueScore),
    tendenciaForca: pickString(training.tendenciaForca, training.strengthTrend, adherence.tendenciaForca, intakeTraining.tendenciaForca, signals.strengthTrend),
    prioridadeMetabolica: pickString(training.prioridadeMetabolica, training.priority, adherence.prioridadeMetabolica, intakeTraining.prioridadeMetabolica, signals.carbohydrateStrategy),
    // Campos expandidos do wizard 6 etapas
    statusTreino: training.statusTreino != null ? training.statusTreino : null,
    perfilTreino: training.perfilTreino != null ? training.perfilTreino : null,
    intensidadeGeral: training.intensidadeGeral != null ? training.intensidadeGeral : null,
    modalidades: Array.isArray(training.modalidades) ? training.modalidades : [],
    rotinaForaTreino: training.rotinaForaTreino != null ? training.rotinaForaTreino : null,
    dorMuscular: training.dorMuscular != null ? training.dorMuscular : null,
    quedaRendimento: training.quedaRendimento != null ? training.quedaRendimento : null,
  }, signals);
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
  var health = safe(raw.saude || raw.healthContext || context.saude || context.healthContext);
  var training = safe(
    raw.contextoTreino || raw.trainingContext || raw.trainingSnapshot ||
    context.contextoTreino || context.trainingContext || profile.contextoTreino || intakeTraining
  );
  var signals = normalizeTrainingSignals(raw, context, profile, health, intakeTraining);

  return {
    modoAjuste: pickString(adherence.modoAjuste, adherence.adjustmentMode),
    praticidade: pickString(adherence.praticidade, adherence.practicality),
    neat: pickString(adherence.neat),
    fadiga: pickNumber(adherence.fadiga, training.fadiga, training.fatigue, intakeTraining.fadiga, signals.fatigueScore),
    tendenciaForca: pickString(adherence.tendenciaForca, training.tendenciaForca, training.strengthTrend, intakeTraining.tendenciaForca, signals.strengthTrend),
    prioridadeMetabolica: pickString(adherence.prioridadeMetabolica, training.prioridadeMetabolica, training.priority, intakeTraining.prioridadeMetabolica, signals.carbohydrateStrategy),
    horarioTreino: pickString(adherence.horarioTreino, intakeTraining.periodo),
    recoveryStatus: signals.recoveryStatus || null,
    recoveryScore: signals.recoveryScore,
    loadState: signals.loadState || null,
    recentPRCount: signals.recentPRCount,
    needsRecoveryFuel: signals.needsRecoveryFuel === true,
    needsProteinDistribution: signals.needsProteinDistribution === true,
    trainingNotes: signals.trainingNotes || [],
  };
}

module.exports = {
  buildTrainingContext: buildTrainingContext,
  buildAdherenceContext: buildAdherenceContext,
};