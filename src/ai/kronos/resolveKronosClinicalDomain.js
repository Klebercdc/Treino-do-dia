'use strict';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function scoreMatch(text, patterns) {
  return patterns.reduce(function (score, pattern) {
    return pattern.test(text) ? score + 1 : score;
  }, 0);
}

function resolveKronosClinicalDomain(input) {
  var options = input && typeof input === 'object' ? input : {};
  var text = normalizeText([
    options.topic,
    options.intent,
    options.message,
    options.userMessage
  ].filter(Boolean).join(' '));

  var workoutScore = scoreMatch(text, [
    /\btreino\b/, /\btreinar\b/, /\bmusculacao\b/, /\bcardio\b/, /\bforca\b/,
    /\bvolume\b/, /\bseries?\b/, /\brepeticoes\b/, /\bcarga\b/, /\brpe\b/,
    /\bfadiga\b/, /\brecuperacao\b/, /\bperformance\b/, /\bworkout\b/
  ]);

  var dietScore = scoreMatch(text, [
    /\bdieta\b/, /\bnutricao\b/, /\brefeicao\b/, /\balimento\b/, /\bgramas\b/,
    /\bmacro/, /\bcaloria/, /\bproteina\b/, /\bcarbo/, /\bgordura\b/,
    /\bemagrecer\b/, /\bcutting\b/, /\bbulking\b/
  ]);

  var labsScore = scoreMatch(text, [
    /\bexames?\b/, /\blaudo\b/, /\blaborator/, /\bbiomarcador/, /\bhemograma\b/,
    /\bcolesterol\b/, /\bglicose\b/, /\binsulina\b/, /\btsh\b/, /\bferritina\b/,
    /\btestosterona\b/, /\bvitamina d\b/, /\bcreatinina\b/, /\bhdl\b/, /\bldl\b/
  ]);

  var matched = [
    workoutScore > 0 ? 'treino' : null,
    dietScore > 0 ? 'dieta' : null,
    labsScore > 0 ? 'exames' : null
  ].filter(Boolean);

  if (matched.length > 1) {
    return {
      key: 'misto',
      label: 'abordagem integrada',
      physicianRole: 'médico do esporte + endocrinologia esportiva',
      matchedDomains: matched,
      confidence: 'high'
    };
  }

  if (labsScore > 0) {
    return {
      key: 'exames',
      label: 'endocrinologia + esporte',
      physicianRole: 'endocrinologista com integração em medicina do esporte',
      matchedDomains: ['exames'],
      confidence: labsScore >= 2 ? 'high' : 'medium'
    };
  }

  if (dietScore > 0) {
    return {
      key: 'dieta',
      label: 'endocrinologia esportiva',
      physicianRole: 'endocrinologista esportivo',
      matchedDomains: ['dieta'],
      confidence: dietScore >= 2 ? 'high' : 'medium'
    };
  }

  if (workoutScore > 0) {
    return {
      key: 'treino',
      label: 'médico do esporte',
      physicianRole: 'médico do esporte',
      matchedDomains: ['treino'],
      confidence: workoutScore >= 2 ? 'high' : 'medium'
    };
  }

  return {
    key: 'misto',
    label: 'abordagem integrada',
    physicianRole: 'médico do esporte + endocrinologia esportiva',
    matchedDomains: ['treino', 'dieta', 'exames'],
    confidence: 'low'
  };
}

module.exports = {
  resolveKronosClinicalDomain: resolveKronosClinicalDomain
};
