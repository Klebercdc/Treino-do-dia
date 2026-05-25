'use strict';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function selectAdaptiveStrategy(user) {
  var objective = normalize(user && (user.objetivo || user.objective));
  var flags = user && user.clinicalData && user.clinicalData.flags || {};
  var activity = normalize(user && user.nivelAtividade);

  if (flags.hasDoencaRenal) return 'renal_hemodialise_conservadora';
  if (flags.hasDiabetes) return 'diabetes_controle_glicemico';
  if (/emagrec|cutting|perder/.test(objective)) return 'emagrecimento_alta_saciedade';
  if (/hipertrof|ganhar|massa/.test(objective) && /intenso|moderado|ativo/.test(activity)) return 'hipertrofia_sustentavel';
  if (/plantao|plantão|noturno/.test(normalize(user && user.workShift))) return 'plantao_hospitalar';
  return 'rotina_equilibrada_adaptativa';
}

function adaptStrategyByBehavior(strategy, behavior) {
  var next = { name: strategy || 'rotina_equilibrada_adaptativa', modifiers: [] };
  if (behavior && behavior.timing === 'night_shift') next.modifiers.push('meal_timing_noturno');
  if (behavior && behavior.comfortFood === 'sweet_craving') next.modifiers.push('snack_doce_controlado');
  if (behavior && behavior.satiety === 'high_hunger') next.modifiers.push('alta_saciedade');
  return next;
}

function adaptStrategyByAdherence(strategy, adherence) {
  var next = Object.assign({ name: strategy || 'rotina_equilibrada_adaptativa', modifiers: [] }, typeof strategy === 'object' ? strategy : {});
  if (adherence && adherence.score < 75) next.modifiers = (next.modifiers || []).concat(['baixa_friccao', 'preparo_simples']);
  return next;
}

function adaptStrategyByHistory(strategy, memory) {
  var next = Object.assign({ name: strategy || 'rotina_equilibrada_adaptativa', modifiers: [] }, typeof strategy === 'object' ? strategy : {});
  if (memory && memory.rejectedFoods && memory.rejectedFoods.length) next.modifiers = (next.modifiers || []).concat(['evitar_rejeitados']);
  if (memory && memory.substitutions && memory.substitutions.length) next.modifiers = (next.modifiers || []).concat(['substituicoes_preferidas']);
  return next;
}

function adaptStrategyByGoal(strategy, progress) {
  var next = Object.assign({ name: strategy || 'rotina_equilibrada_adaptativa', modifiers: [] }, typeof strategy === 'object' ? strategy : {});
  if (progress && progress.plateau) next.modifiers = (next.modifiers || []).concat(['anti_plato']);
  if (progress && progress.fastLoss) next.modifiers = (next.modifiers || []).concat(['conservador']);
  return next;
}

function buildAdaptiveStrategy(profile, behavior, adherence, memory, progress) {
  var selected = selectAdaptiveStrategy(profile || {});
  var byBehavior = adaptStrategyByBehavior(selected, behavior || {});
  var byAdherence = adaptStrategyByAdherence(byBehavior, adherence || {});
  var byHistory = adaptStrategyByHistory(byAdherence, memory || {});
  var finalStrategy = adaptStrategyByGoal(byHistory, progress || {});

  return {
    strategy: finalStrategy.name,
    modifiers: Array.from(new Set(finalStrategy.modifiers || [])),
    enterpriseAI: true,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  selectAdaptiveStrategy: selectAdaptiveStrategy,
  adaptStrategyByBehavior: adaptStrategyByBehavior,
  adaptStrategyByAdherence: adaptStrategyByAdherence,
  adaptStrategyByHistory: adaptStrategyByHistory,
  adaptStrategyByGoal: adaptStrategyByGoal,
  buildAdaptiveStrategy: buildAdaptiveStrategy
};
