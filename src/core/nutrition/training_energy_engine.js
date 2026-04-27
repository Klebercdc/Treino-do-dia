'use strict';

var MET_TABLE = {
  caminhada_leve: 3,
  cardio_moderado: 5,
  musculacao_leve: 3.5,
  musculacao_moderada: 5,
  musculacao_intenso: 6,
  crossfit_moderado: 8,
  crossfit_intenso: 10,
  corrida_moderada: 8,
  corrida_intenso: 10,
  bike_moderada: 6,
  bike_intenso: 8,
  funcional_moderado: 6,
  funcional_intenso: 8,
  esporte_moderado: 6,
  esporte_intenso: 8,
  cardio_leve: 3,
  cardio_intenso: 7,
  caminhada_moderado: 4,
  caminhada_intenso: 5,
};

var NEAT_FACTORS = {
  trabalho_sentado: 1.2,
  trabalho_em_pe: 1.35,
  trabalho_fisico_leve: 1.45,
  trabalho_fisico_pesado: 1.6,
};

var ACTIVITY_FACTORS_FALLBACK = {
  sedentary: 1.2,
  sedentario: 1.2,
  light: 1.375,
  leve: 1.375,
  moderate: 1.55,
  moderado: 1.55,
  active: 1.725,
  ativo: 1.725,
  very_active: 1.9,
  muito_ativo: 1.9,
};

function getMetForActivity(tipo, intensidade) {
  var key = String(tipo || '').toLowerCase() + '_' + String(intensidade || '').toLowerCase();
  if (MET_TABLE[key] != null) return MET_TABLE[key];
  var intens = String(intensidade || '').toLowerCase();
  if (intens === 'leve') return 3;
  if (intens === 'intenso') return 7;
  return 5;
}

function normalizeTrainingContext(training) {
  var t = training && typeof training === 'object' ? training : {};
  var modalidades = Array.isArray(t.modalidades) ? t.modalidades : [];

  if (!modalidades.length) {
    return { hasTraining: false, modalidades: [], statusTreino: t.statusTreino || null, perfilTreino: t.perfilTreino || null, intensidadeGeral: t.intensidadeGeral || null, rotinaForaTreino: t.rotinaForaTreino || null, fadiga: t.fadiga || null, dorMuscular: t.dorMuscular || null, quedaRendimento: t.quedaRendimento || null };
  }

  var validModalidades = modalidades.map(function(m) {
    var dias = Math.min(7, Math.max(1, Number(m.diasSemana) || 1));
    var duracao = Math.max(1, Number(m.duracaoMinutos) || 45);
    return {
      tipo: String(m.tipo || 'outro').toLowerCase(),
      diasSemana: dias,
      duracaoMinutos: duracao,
      intensidade: String(m.intensidade || 'moderado').toLowerCase(),
      horario: m.horario || null,
      objetivo: m.objetivo || null,
    };
  }).filter(function(m) { return m.duracaoMinutos > 0; });

  return {
    hasTraining: validModalidades.length > 0,
    modalidades: validModalidades,
    statusTreino: t.statusTreino || null,
    perfilTreino: t.perfilTreino || null,
    intensidadeGeral: t.intensidadeGeral || null,
    rotinaForaTreino: t.rotinaForaTreino || null,
    fadiga: t.fadiga !== undefined ? t.fadiga : null,
    dorMuscular: t.dorMuscular || null,
    quedaRendimento: t.quedaRendimento || null,
  };
}

function calculateWeeklyTrainingCalories(training, pesoKg) {
  var t = training && typeof training === 'object' ? training : {};
  var modalidades = Array.isArray(t.modalidades) ? t.modalidades : [];
  var total = 0;
  var por_modalidade = modalidades.map(function(m) {
    var met = getMetForActivity(m.tipo, m.intensidade);
    var horas = m.duracaoMinutos / 60;
    var gasto = met * pesoKg * horas * m.diasSemana;
    total += gasto;
    return { tipo: m.tipo, intensidade: m.intensidade, diasSemana: m.diasSemana, duracaoMinutos: m.duracaoMinutos, met: met, gasto_semanal_kcal: Math.round(gasto) };
  });
  return { total_semanal_kcal: Math.round(total), por_modalidade: por_modalidade };
}

function calculateDailyTrainingCalories(training, pesoKg) {
  var weekly = calculateWeeklyTrainingCalories(training, pesoKg);
  return { daily_kcal: Math.round(weekly.total_semanal_kcal / 7), weekly_kcal: weekly.total_semanal_kcal };
}

function calculateNeatCalories(tmb, rotinaForaTreino) {
  var factor = NEAT_FACTORS[rotinaForaTreino] != null ? NEAT_FACTORS[rotinaForaTreino] : 1.2;
  var neat = tmb * factor - tmb;
  return { neat_kcal: Math.round(neat), factor_used: factor };
}

function calculateActivityAdjustedGet(profile, bmr) {
  var p = profile && typeof profile === 'object' ? profile : {};
  var weight_kg = p.weight_kg != null ? p.weight_kg : (p.peso != null ? p.peso : 70);
  var training = p.training && typeof p.training === 'object' ? p.training : { hasTraining: false, modalidades: [] };
  var rotinaForaTreino = (training && training.rotinaForaTreino) || p.rotinaForaTreino || null;

  if (training.hasTraining === true) {
    var dailyTraining = calculateDailyTrainingCalories(training, weight_kg);
    var neat = calculateNeatCalories(bmr, rotinaForaTreino);
    var get = bmr + neat.neat_kcal + dailyTraining.daily_kcal;
    return {
      get: Math.round(get),
      bmr: bmr,
      neat_kcal: neat.neat_kcal,
      training_daily_kcal: dailyTraining.daily_kcal,
      training_weekly_kcal: dailyTraining.weekly_kcal,
      getCalculationMode: 'training_based',
    };
  }

  var actLevel = p.activityLevel || p.nivelAtividade || 'sedentary';
  var factor = ACTIVITY_FACTORS_FALLBACK[actLevel] || ACTIVITY_FACTORS_FALLBACK.sedentary;
  return {
    get: Math.round(bmr * factor),
    bmr: bmr,
    neat_kcal: null,
    training_daily_kcal: null,
    training_weekly_kcal: null,
    getCalculationMode: 'activity_factor_fallback',
  };
}

module.exports = {
  getMetForActivity: getMetForActivity,
  normalizeTrainingContext: normalizeTrainingContext,
  calculateWeeklyTrainingCalories: calculateWeeklyTrainingCalories,
  calculateDailyTrainingCalories: calculateDailyTrainingCalories,
  calculateNeatCalories: calculateNeatCalories,
  calculateActivityAdjustedGet: calculateActivityAdjustedGet,
  MET_TABLE: MET_TABLE,
  NEAT_FACTORS: NEAT_FACTORS,
  ACTIVITY_FACTORS_FALLBACK: ACTIVITY_FACTORS_FALLBACK,
};
