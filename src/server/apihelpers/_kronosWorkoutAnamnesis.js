'use strict';

var _requiredByMode = {
  full_workout:        ['obj', 'nivel', 'dias', 'tempo', 'equip'],
  specific_workout:    ['musculo', 'focoSessao', 'equip', 'tempo'],
  protocol_adjustment: ['problema', 'direcao'],
};

function buildKronosWorkoutAnamnesis(opts) {
  var mode     = opts.mode || 'full_workout';
  var ctx      = opts.kronosContext || {};
  var answers  = opts.existingAnswers && typeof opts.existingAnswers === 'object' ? opts.existingAnswers : {};
  var required = _requiredByMode[mode] || _requiredByMode.full_workout;
  var missing  = required.filter(function(f) { return !answers[f]; });

  var enriched = Object.assign({}, answers);
  var np = ctx.nutritionProfile;
  if (np) {
    if (!enriched.nivel && np.nivel_atividade) enriched._suggestedNivel = _mapNivel(np.nivel_atividade);
    if (!enriched.obj   && np.objetivo)        enriched._suggestedObj   = np.objetivo;
  }

  // protocol_adjustment fallback
  if (mode === 'protocol_adjustment' && !ctx.available) {
    return {
      mode: mode, canGenerateNow: false, missingFields: missing,
      enrichedAnswers: enriched,
      fallbackMessage: 'Nenhum protocolo ativo encontrado. Posso criar um treino completo.',
      fallbackMode: 'full_workout',
    };
  }

  return {
    mode: mode, canGenerateNow: missing.length === 0,
    missingFields: missing, enrichedAnswers: enriched,
    fallbackMessage: null, fallbackMode: null,
  };
}

function getRequiredQuestionsForMode(mode) {
  return _requiredByMode[mode] || _requiredByMode.full_workout;
}

function mergeAnamnesisAnswersWithContext(kronosContext, answers) {
  var merged = Object.assign({}, answers);
  var np = kronosContext && kronosContext.nutritionProfile;
  if (!np) return merged;
  if (!merged.nivel   && np.nivel_atividade) merged.nivel = _mapNivel(np.nivel_atividade);
  if (!merged.obj     && np.objetivo)        merged.obj   = np.objetivo;
  if ((!merged.limitacoes || merged.limitacoes === 'nao') && np.condicoes_saude && np.condicoes_saude.length)
    merged.limitacoes = np.condicoes_saude.join(', ');
  return merged;
}

function _mapNivel(n) {
  var m = { sedentario: 'iniciante', leve: 'iniciante', moderado: 'intermediario', ativo: 'intermediario', muito_ativo: 'avancado' };
  return m[n] || 'iniciante';
}

module.exports = {
  buildKronosWorkoutAnamnesis: buildKronosWorkoutAnamnesis,
  getRequiredQuestionsForMode: getRequiredQuestionsForMode,
  mergeAnamnesisAnswersWithContext: mergeAnamnesisAnswersWithContext,
};
