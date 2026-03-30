function pick(list, seed) {
  if (!list.length) return '';
  var index = Math.abs((seed || '').length) % list.length;
  return list[index];
}

function buildLocalReply(decision, classification) {
  var triage = classification.triage;
  var text = classification.sanitizedText || '';

  var catalog = {
    greeting_short: [
      'Oi. Me fala o que você quer fazer agora.',
      'Fala. Me diz direto no que você quer ajuda.'
    ],
    greeting_repeated: [
      'Tô por aqui. Manda direto o que você precisa.',
      'Tô bem 😄 agora me fala o que você quer resolver.'
    ],
    noise: [
      'Fechou. Quando quiser, manda o objetivo.',
      'Manda em uma frase o que você quer resolver.'
    ],
    test_surface: [
      'Funcionando. Manda o que você quer resolver agora.',
      'Tô on. Pode mandar seu objetivo em uma frase.'
    ],
    filler: ['Tô aqui. Quando quiser, manda direto o ponto.'],
    acknowledgment: ['Perfeito.', 'Boa, seguimos.'],
    topic_mention: {
      workout: 'Você quer montar um treino, ajustar o atual ou tirar uma dúvida?',
      diet: 'Você quer montar uma dieta ou ajustar a que já tem?',
      supplement: 'Você quer saber se vale a pena, como usar ou qual dose?',
      exercise: 'Você quer ajustar técnica, trocar exercício ou aliviar dor?',
      general: 'Te ajudo sim. É treino, dieta ou suplemento?'
    },
    vague_single_word: 'Te ajudo sim. É treino, dieta ou suplemento?',
    complaint: 'Beleza, vamos ajustar do jeito certo. O que ficou ruim exatamente?',
    vent: 'Entendi. Hoje dá para ajustar sem forçar. Seu cansaço é muscular, sono ruim ou estresse?',
    ask_rephrase: 'Manda em uma frase o que você quer resolver.'
  };

  if (triage === 'topic_mention') {
    if (/creatina|whey|cafeina|suplemento/.test(text)) return catalog.topic_mention.supplement;
    if (/dieta|secar|massa|caloria/.test(text)) return catalog.topic_mention.diet;
    if (/treino|hipertrofia|forca/.test(text)) return catalog.topic_mention.workout;
    if (/dor|exercicio/.test(text)) return catalog.topic_mention.exercise;
    return catalog.topic_mention.general;
  }

  if (triage === 'vague_single_word') return catalog.vague_single_word;
  if (decision.action === 'ask_clarifying') {
    if (/secar sem perder massa/.test(text)) return 'Dá pra fazer. Você quer estratégia de dieta, treino ou os dois?';
    if (/creatina/.test(text)) return catalog.topic_mention.supplement;
    if (/treino/.test(text)) return catalog.topic_mention.workout;
    if (/dieta|secar|massa/.test(text)) return catalog.topic_mention.diet;
    return catalog.vague_single_word;
  }
  if (triage === 'complaint') {
    if (/nao entendi|confuso/.test(text)) return 'Fechou. Me diz o ponto exato que ficou confuso e eu simplifico em 1 frase.';
    return catalog.complaint;
  }
  if (triage === 'vent') return catalog.vent;
  if (decision.action === 'ask_rephrase') return catalog.ask_rephrase;

  return pick(catalog[triage] || catalog.noise, text);
}

module.exports = {
  buildLocalReply: buildLocalReply
};
