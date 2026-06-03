'use strict';

var knowledge = require('./_defaultTrainingKnowledge');

function deriveKronosWorkoutDecision(opts) {
  var mode    = opts.mode    || 'full_workout';
  var ctx     = opts.kronosContext || {};
  var answers = opts.anamnesisAnswers || {};

  var np      = ctx.nutritionProfile || {};
  var fatigue = ctx.fatigue;
  var diet    = ctx.diet;
  var labs    = ctx.labs;

  var nivel  = answers.nivel  || _mapNivel(np.nivel_atividade) || 'iniciante';
  var obj    = answers.obj    || np.objetivo || 'hipertrofia';
  var dias   = parseInt(answers.dias || '4', 10);
  var tempo  = answers.tempo  || '60';
  var equip  = answers.equip  || 'academia_completa';
  var fase   = answers.fase   || '2';
  var idade  = np.idade  || null;
  var peso   = np.peso_kg || null;

  var vm   = 1.0;
  var adj  = [];

  // Fadiga
  if (fatigue) {
    if (fatigue.score >= 7)      { vm *= 0.65; adj.push({ type: 'fatigue_high',     reason: 'Fadiga elevada (' + fatigue.score + '/10) — volume reduzido 35%' }); }
    else if (fatigue.score >= 5) { vm *= 0.82; adj.push({ type: 'fatigue_moderate', reason: 'Fadiga moderada (' + fatigue.score + '/10) — volume ajustado' }); }
    else                         { vm *= 1.05; adj.push({ type: 'fatigue_low',      reason: 'Boa disposição — progressão mantida' }); }
  } else {
    vm = 0.85;
    adj.push({ type: 'fatigue_unknown', reason: 'Fadiga desconhecida — intensidade conservadora' });
  }

  // Dieta
  if (diet) {
    var pPerKg = peso && diet.total_proteina ? diet.total_proteina / peso : null;
    if (pPerKg !== null && pPerKg < 1.6) { vm *= 0.80; adj.push({ type: 'low_protein', reason: 'Proteína abaixo de 1.6g/kg — volume reduzido' }); }
    if (diet.total_calorias > 0 && diet.total_calorias < 1600) { vm *= 0.85; adj.push({ type: 'deficit_cal', reason: 'Déficit calórico — evitar falha frequente' }); }
  }

  // Idade
  if (idade) {
    if (idade >= 60) { vm *= 0.85; adj.push({ type: 'age_senior', reason: 'Acima de 60 — aquecimento estendido e progressão controlada' }); }
    else if (idade >= 40) adj.push({ type: 'age_40', reason: 'Acima de 40 — atenção articular' });
  }

  // Safety flags
  var safetyFlags = ctx.safetyFlags || [];
  if (safetyFlags.length) { vm *= 0.90; adj.push({ type: 'safety_flags', reason: 'Biomarcadores com atenção — volume ajustado por segurança' }); }

  var proto   = knowledge.protocolSelector(dias, nivel);
  var prInfo  = knowledge.protocols.filter(function(p) { return p.id === proto; })[0] || {};
  var volR    = knowledge.volumeRules[nivel] || knowledge.volumeRules.intermediario;

  var rpe = volR.intensity;
  if (fatigue && fatigue.score >= 7) rpe = 'RPE 5-7';

  var prog = knowledge.progression.default;
  if (nivel === 'iniciante') prog = knowledge.progression.conservative;
  if (obj === 'hipertrofia') prog = knowledge.progression.hypertrophy;

  var deload = !!(
    (fatigue && fatigue.score >= 8) ||
    (ctx.adaptationEvents && ctx.adaptationEvents.some(function(e) { return e.adaptation_type === 'DELOAD'; }))
  );

  var lims = answers.limitacoes && answers.limitacoes !== 'nao'
    ? (Array.isArray(answers.limitacoes) ? answers.limitacoes : String(answers.limitacoes).split(',').map(function(s) { return s.trim(); }))
    : [];

  return {
    selectedProtocol:    proto,
    selectedSplit:       prInfo.description || proto,
    targetMuscleGroups:  [],
    volumePlan:          volR,
    volumeMultiplier:    parseFloat(vm.toFixed(2)),
    intensityPlan:       rpe,
    progressionModel:    prog,
    exerciseSelectionRules: { equipment: [equip], nivel: nivel, limitations: lims, excludeOverloaded: ctx.overloadedMuscleGroups || [], prioritizeNeglected: ctx.neglectedMuscleGroups || [] },
    selectedExercises:   [],
    contraindications:   lims,
    deloadRecommendation: deload,
    readiness:           ctx.readiness || { score: null, level: 'desconhecida', reasons: [] },
    appliedAdjustments:  adj,
    safetyFlags:         safetyFlags,
    explanation:         _explain(ctx.personalizationLevel, adj, safetyFlags),
    volumeRationale:     'Nível ' + nivel + ': ' + volR.weeklySetsPerMuscle + ' séries/músculo/semana' + (vm !== 1.0 ? ' (×' + vm.toFixed(2) + ')' : ''),
    intensityRationale:  rpe,
    progressionRationale: prog,
  };
}

function _mapNivel(n) {
  var m = { sedentario: 'iniciante', leve: 'iniciante', moderado: 'intermediario', ativo: 'intermediario', muito_ativo: 'avancado' };
  return m[n] || null;
}

function _explain(level, adj, flags) {
  if (level === 'precision') return 'Treino gerado em modo precision. O KRONOS considerou dieta ativa, biomarcadores, fadiga recente, histórico de treino, alertas e base técnica para ajustar volume, intensidade, protocolo e seleção de exercícios.';
  if (level === 'advanced')  return 'Treino gerado em modo avançado. Ajustes: ' + adj.map(function(a) { return a.reason; }).join('; ') + '.';
  if (level === 'contextual') return 'Treino gerado com contexto parcial. O KRONOS usou perfil e histórico disponíveis para personalizar o plano.';
  return 'Treino gerado em modo base. O KRONOS utilizou as respostas da anamnese, perfil e objetivo para gerar um plano conservador e seguro. Para personalização clínica, complete dieta, exames e registre sua fadiga.';
}

module.exports = {
  deriveKronosWorkoutDecision: deriveKronosWorkoutDecision,
};
