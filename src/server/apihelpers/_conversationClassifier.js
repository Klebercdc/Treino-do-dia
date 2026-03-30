function extractLastUserMessage(messages) {
  if (!Array.isArray(messages) || !messages.length) return '';

  for (var i = messages.length - 1; i >= 0; i--) {
    var msg = messages[i];
    if (!msg || typeof msg !== 'object') continue;
    if (String(msg.role || '').toLowerCase() !== 'user') continue;

    if (typeof msg.content === 'string') return msg.content.trim();
    if (Array.isArray(msg.content)) {
      return msg.content.map(function(part) {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      }).join(' ').trim();
    }

    if (msg.content && typeof msg.content.text === 'string') return msg.content.text.trim();
  }

  return '';
}

function normalizeConversationInput(text) {
  var originalText = String(text || '');
  var lowered = originalText.toLowerCase();
  var normalizedText = lowered
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  var reduced = normalizedText
    .replace(/([a-z])\1{2,}/g, '$1')
    .replace(/([?!.,])\1{1,}/g, '$1')
    .replace(/(\b\w+\b)(\s+\1\b){2,}/g, '$1 $1')
    .replace(/(\b[\w]+\s+[\w]+\b)(\s+\1\b)+/g, '$1')
    .replace(/\b(kkkk)k+\b/g, 'kkkk')
    .replace(/\s+/g, ' ')
    .trim();

  var tokens = reduced ? reduced.split(/\s+/).filter(Boolean) : [];
  var onlyEmoji = /^[\p{Extended_Pictographic}\s]+$/u.test(normalizedText) && !!normalizedText;
  var onlyPunctuation = /^[^\p{L}\p{N}]+$/u.test(normalizedText) && !!normalizedText;
  var laughOnly = /^(k|ha|rs|kkk|haha|hahaha|hehe)+$/.test(reduced.replace(/\s+/g, ''));
  var noiseOnly = onlyEmoji || onlyPunctuation || laughOnly || /^(hmm+|hm+|...|teste|1 2 3|alo|al[oô]|ta on\??)$/i.test(reduced);

  return {
    originalText: originalText,
    normalizedText: normalizedText,
    reducedText: reduced,
    tokenCount: tokens.length,
    charCount: reduced.length,
    flags: {
      isVeryShort: tokens.length <= 2 || reduced.length <= 8,
      isOnlyEmoji: onlyEmoji,
      isOnlyPunctuation: onlyPunctuation,
      isLaughOnly: laughOnly,
      isNoise: noiseOnly,
      isEmpty: !normalizedText,
      isRepeatedSurface: normalizedText !== reduced
    }
  };
}

function triageMessage(input) {
  var text = (input && input.reducedText) || '';
  var tokens = text.split(/\s+/).filter(Boolean);

  if (!text) return 'noise';
  if (input.flags.isNoise || input.flags.isOnlyPunctuation || input.flags.isOnlyEmoji) return 'noise';
  if (/^(oi|ola|olá|opa|fala|e ai|salve|bom dia|boa tarde|boa noite)$/.test(text)) return 'greeting_short';
  if (/^(oi\s+oi|oi\s+oi\s+oi|fala\s+fala|como ce ta(\s+como ce ta)?)$/.test(text) || input.flags.isRepeatedSurface) return 'greeting_repeated';
  if (/^(teste|1 2 3|funciona\??|alo|ta on\??|hmm+|hm+|\?)$/.test(text)) return 'test_surface';
  if (/^(ok|blz|beleza|entendi|fechou|show)$/.test(text)) return 'acknowledgment';
  if (/^(ajuda|me ajuda|socorro|nao sei|me explica|duvida)$/.test(text)) return 'vague_single_word';
  if (/^(hmm|hm|tipo|sei la)$/.test(text)) return 'filler';
  if (/(ruim|nao gostei|ficou ruim|nao entendi|confuso)/.test(text)) return 'complaint';
  if (/(to cansado|travado|estagnado|nao evoluo|nao cresco|nao respondo mais|perdido|dificil|desmotivado)/.test(text)) return 'vent';

  var hasQuestionMarker = /\?|\b(como|o que|qual|quando|por que|porque|funciona|vale|compensa|devo|sera que|e hora de|ta na hora de|continuo ou mudo|pode|devo)\b/.test(text);
  if (hasQuestionMarker) return 'direct_question';

  if (/\b(quero|monta|montar|cria|criar|gere|gera|ajusta|revisa|preciso|me ajuda|troco|corto|subo|desco|planeja|estruture|organiza)\b/.test(text)) return 'direct_request';
  if (/\b(esse treino|essa dieta|ajusta|mudar|corrigir|mudar volume|mudar frequencia)\b/.test(text)) return 'adjustment_request';
  if (/\b(progresso|evolui|evolucao|plato|travei|resultado|deload agora)\b/.test(text)) return 'progress_question';
  if (/\b(treino|dieta|creatina|suplemento|cutting|bulking|dor)\b/.test(text) && tokens.length <= 3 && !/\?/.test(text)) return 'topic_mention';
  if (/\b(exercicio|fisiologia|periodizacao|macros|tdee|dosagem)\b/.test(text)) return 'technical_question';
  return 'unknown';
}

function buildSemanticSignals(text) {
  return {
    asksForPlan: /\b(monta|montar|cria|criar|gera|gerar|planeja|estruture|organiza)\b/.test(text),
    asksForAdjustment: /\b(ajusta|ajustar|corrigir|mudar|troco|corto|subo|desco|revisa|revisar)\b/.test(text),
    asksForExplanation: /\b(como|por que|porque|explica|funciona|qual|quando|vale|compensa|devo|sera que)\b/.test(text),
    topicShiftCue: /\b(agora|mudando de assunto|outro assunto|deixa isso|falando nisso)\b/.test(text),
    vagueReference: /\b(isso|essa|esse|aquilo|assim)\b/.test(text),
    progressSignal: /\b(travado|estagnado|nao evoluo|plato|deload|progresso|recuperacao)\b/.test(text)
  };
}

function classifyIntent(input, continuationContext) {
  var text = (input && input.reducedText) || '';
  var triage = triageMessage(input);
  var inheritedTopic = continuationContext && continuationContext.inheritedTopic;
  var inheritedNeed = continuationContext && continuationContext.inheritedNeed;
  var continuationHit = !!(continuationContext && continuationContext.continuationHit);
  var semanticSignals = buildSemanticSignals(text);

  var scores = {
    action: { request: 0, question: 0, adjust: 0, vent: 0, complaint: 0 },
    topic: { workout: 0, diet: 0, supplement: 0, exercise: 0, recovery: 0, progress: 0, motivation: 0, general: 0 },
    emotion: 0,
    clarity: Math.max(0, Math.min(1, (input.tokenCount || 0) / 8))
  };

  if (semanticSignals.asksForPlan) scores.action.request += 2;
  if (semanticSignals.asksForExplanation || /\?/.test(text)) scores.action.question += 1.5;
  if (semanticSignals.asksForAdjustment) scores.action.adjust += 2;
  if (/\b(cansado|travado|estagnado|nao evoluo|nao cresco|nao respondo mais|perdido|desmotivado|dificil)\b/.test(text)) {
    scores.action.vent += 1.5;
    scores.emotion += 2;
  }
  if (/\b(nao entendi|confuso|ruim)\b/.test(text)) scores.action.complaint += 1.5;

  if (/\b(treino|hipertrofia|forca|divisao|ficha|volume|frequencia)\b/.test(text)) scores.topic.workout += 2;
  if (/\b(dieta|caloria|macro|emagrecer|secar|massa|cutting)\b/.test(text)) scores.topic.diet += 2;
  if (/\b(creatina|whey|cafeina|suplemento|dose)\b/.test(text)) scores.topic.supplement += 2;
  if (/\b(exercicio|agachamento|supino|remada|dor)\b/.test(text)) scores.topic.exercise += 1.5;
  if (/\b(recuperacao|sono|fadiga|deload|cansado)\b/.test(text)) scores.topic.recovery += 1.5;
  if (/\b(progresso|evolui|plato|resultado|estagnado)\b/.test(text)) scores.topic.progress += 1.5;
  if (scores.topic.supplement >= 2 && !/\b(monta|montar|cria|criar|gera|gerar)\b.*\b(treino|ficha|divisao)\b/.test(text)) {
    scores.topic.workout = Math.max(0, scores.topic.workout - 1);
  }
  if (scores.topic.supplement >= 2 && /\b(qual|vale|funciona|evidencia|tomar|dose)\b/.test(text)) {
    scores.topic.supplement += 1;
  }

  if (continuationHit && inheritedTopic && !semanticSignals.topicShiftCue && scores.topic[inheritedTopic] < 1.5) {
    scores.topic[inheritedTopic] += 1.5;
  }
  if (continuationHit && inheritedNeed === 'create') scores.action.request += 1;
  if (continuationHit && /^(montar|ajustar|revisar)$/.test(text)) scores.action.request += 2;

  var topTopic = 'general';
  Object.keys(scores.topic).forEach(function(k) {
    if (scores.topic[k] > scores.topic[topTopic]) topTopic = k;
  });

  var kind = 'general';
  if (triage.indexOf('greeting') === 0) kind = 'greeting';
  else if (triage === 'direct_request') kind = 'request';
  else if (triage === 'direct_question' || triage === 'technical_question' || triage === 'progress_question') kind = 'question';
  else if (triage === 'adjustment_request') kind = 'adjust';
  else if (triage === 'complaint') kind = 'complaint';
  else if (triage === 'vent') kind = 'vent';
  else if (triage === 'acknowledgment') kind = 'confirmation';
  else if (triage === 'unknown' || triage === 'noise' || triage === 'test_surface') kind = 'unknown';

  if (continuationHit && /^(montar|ajustar|revisar)$/.test(text)) kind = 'request';

  var confidence = Math.min(0.98, 0.35 + scores.clarity + (scores.topic[topTopic] / 6));
  if (semanticSignals.asksForExplanation || semanticSignals.asksForPlan) confidence = Math.min(0.98, confidence + 0.05);
  if (continuationHit && !semanticSignals.topicShiftCue) confidence = Math.min(0.98, confidence + 0.12);
  if (triage === 'unknown') confidence = Math.max(0.4, confidence - 0.2);
  if (semanticSignals.topicShiftCue && continuationHit) confidence = Math.max(0.45, confidence - 0.12);

  return {
    triage: triage,
    kind: kind,
    topic: topTopic,
    depth: 'micro',
    action: 'ask_clarifying',
    confidence: confidence,
    flags: input.flags,
    semanticSignals: semanticSignals,
    continuation: {
      hit: continuationHit,
      inheritedTopic: inheritedTopic || null,
      inheritedNeed: inheritedNeed || null
    },
    sanitizedText: text,
    scores: scores
  };
}

module.exports = {
  extractLastUserMessage: extractLastUserMessage,
  normalizeConversationInput: normalizeConversationInput,
  triageMessage: triageMessage,
  classifyIntent: classifyIntent
};
