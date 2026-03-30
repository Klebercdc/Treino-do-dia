var CONFIDENCE_SAFE_THRESHOLD = 0.6;
var FLOW_CONFIDENCE_THRESHOLD = 0.75;
var MAX_CONSECUTIVE_CLARIFICATIONS = 2;

function hasAny(text, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].test(text)) return true;
  }
  return false;
}

function evaluateComplexity(classification) {
  var text = String(classification.sanitizedText || '');
  var score = 0;
  var signals = {
    mixedIntent: false,
    comparison: false,
    constraints: false,
    clinicalContext: false,
    compositeGoal: false,
    causalNeed: false,
    strategicRequest: false,
    stepByStep: false,
    analysisRequest: false,
    ambiguity: false,
    shortDenseDecision: false,
    stagnationSignal: false,
    adjustmentDecision: false
  };

  signals.mixedIntent = hasAny(text, [/\b(treino|dieta)\b/]) && hasAny(text, [/\b(e|junto|ao mesmo tempo|ou)\b/]);
  signals.comparison = hasAny(text, [/\b(vs|comparar|melhor que|diferen[çc]a)\b/]);
  signals.constraints = hasAny(text, [/\b(sem|evitar|nao posso|restri[cç][aã]o|alergia|les[ãa]o|dor)\b/]);
  signals.clinicalContext = hasAny(text, [/\b(diabetes|hipertens[aã]o|ansiedade|ins[ôo]nia|exame|medic[ao][cç][aã]o)\b/]);
  signals.compositeGoal = hasAny(text, [/\b(secar sem perder massa|ganhar massa e perder gordura|recomposi[cç][aã]o|secar agora|deload agora)\b/]);
  signals.causalNeed = hasAny(text, [/\b(por que|porque|causa|motivo)\b/]);
  signals.strategicRequest = hasAny(text, [/\b(estrat[eé]gia|plano|protocolo|periodiza[cç][aã]o|microciclo)\b/]);
  signals.stepByStep = hasAny(text, [/\b(passo a passo|etapas|roteiro|como fazer)\b/]);
  signals.analysisRequest = hasAny(text, [/\b(analisa|avaliar|diagnosticar|revisar|auditar)\b/]);
  signals.ambiguity = classification.triage === 'unknown' || classification.triage === 'vague_single_word';
  signals.shortDenseDecision = hasAny(text, [/\b(vale a pena|compensa|devo|sera que|e hora de|ta na hora de|continuo ou mudo)\b/]);
  signals.stagnationSignal = hasAny(text, [/\b(travado|estagnado|nao evoluo|nao cresco|nao respondo mais)\b/]);
  signals.adjustmentDecision = hasAny(text, [/\b(troco|corto|subo|desco|mudar volume|mudar frequencia)\b/]);

  var weights = {
    mixedIntent: 1,
    comparison: 1,
    constraints: 1,
    clinicalContext: 1,
    compositeGoal: 2,
    causalNeed: 1,
    strategicRequest: 1,
    stepByStep: 1,
    analysisRequest: 1,
    ambiguity: 1,
    shortDenseDecision: 2,
    stagnationSignal: 2,
    adjustmentDecision: 2
  };

  Object.keys(signals).forEach(function(key) {
    if (signals[key]) score += (weights[key] || 1);
  });

  if (text.split(/\s+/).filter(Boolean).length >= 18) score += 1;
  if (classification.kind === 'question' && classification.topic !== 'general') score += 1;

  var level = 'low';
  if (score >= 3 && score <= 6) level = 'medium';
  if (score >= 7) level = 'high';

  return { score: score, level: level, signals: signals };
}

function decideDepth(classification, complexity) {
  var triage = classification.triage;
  if (triage === 'greeting_short' || triage === 'greeting_repeated' || triage === 'noise' || triage === 'filler' || triage === 'test_surface' || triage === 'acknowledgment') return 'micro';
  if (triage === 'topic_mention' || triage === 'vague_single_word') return 'micro';
  if (triage === 'complaint' || triage === 'vent' || triage === 'adjustment_request') return complexity.level === 'high' ? 'normal' : 'short';
  if (classification.kind === 'question' || triage === 'technical_question' || triage === 'progress_question') return complexity.level === 'low' ? 'short' : 'normal';
  if (classification.kind === 'request' && (classification.topic === 'workout' || classification.topic === 'diet')) return complexity.level === 'high' ? 'full' : 'normal';
  return complexity.level === 'high' ? 'normal' : 'short';
}

function resolveTokenLimit(decision) {
  var depth = decision.depth || 'short';
  var score = (decision.complexity && decision.complexity.score) || 0;

  if (depth === 'micro') return 60;
  if (depth === 'short') return score >= 4 ? 160 : 120;
  if (depth === 'normal') return score >= 7 ? 350 : 250;
  if (depth === 'full') return score >= 9 ? 900 : 700;
  return 120;
}

function isStrongContext(state, classification) {
  if (!state) return false;
  if (!state.awaitingClarification) return false;
  if (!classification.continuation || !classification.continuation.hit) return false;
  return (state.lastTopic && state.lastTopic === classification.topic) || classification.confidence >= 0.72;
}

function decideAction(classification, conversationState) {
  var complexity = evaluateComplexity(classification);
  var state = conversationState || {};
  var strongContext = isStrongContext(state, classification);
  var decision = {
    depth: decideDepth(classification, complexity),
    action: 'call_llm_short',
    topic: classification.topic,
    kind: classification.kind,
    complexity: complexity,
    tokenLimit: 120,
    debug: {
      triage: classification.triage,
      confidence: classification.confidence,
      complexityScore: complexity.score,
      continuationHit: !!(classification.continuation && classification.continuation.hit),
      clarificationCount: state.clarificationCount || 0
    }
  };

  if (classification.flags.isOnlyPunctuation || classification.flags.isEmpty) {
    decision.action = 'ask_rephrase';
    decision.depth = 'micro';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (classification.triage === 'noise' || classification.triage === 'greeting_short' || classification.triage === 'greeting_repeated' || classification.triage === 'test_surface' || classification.triage === 'acknowledgment' || classification.triage === 'filler') {
    decision.action = 'local_reply';
    decision.depth = 'micro';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (classification.triage === 'vague_single_word' || classification.triage === 'topic_mention') {
    decision.action = 'ask_clarifying';
    decision.depth = 'micro';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if ((classification.confidence < CONFIDENCE_SAFE_THRESHOLD) && !strongContext) {
    decision.action = 'ask_clarifying';
    decision.depth = 'micro';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if ((state.lastAction === 'ask_clarifying' || state.lastAction === 'ask_rephrase') && classification.continuation && classification.continuation.hit) {
    if (classification.kind === 'general' && state.lastTopic === 'workout' && /montar|criar|gerar/.test(classification.sanitizedText)) {
      classification.kind = 'request';
      classification.topic = 'workout';
    }
    if (classification.kind === 'general' && state.lastTopic === 'diet' && /secar|dieta|ajustar/.test(classification.sanitizedText)) {
      classification.kind = 'request';
      classification.topic = 'diet';
    }
  }


  if (strongContext && classification.kind === 'request' && state.lastTopic === 'workout' && /montar|criar|gerar/.test(classification.sanitizedText)) {
    decision.action = 'open_workout_flow';
    decision.depth = 'normal';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (strongContext && classification.kind === 'request' && state.lastTopic === 'diet' && /montar|criar|gerar|dieta|secar/.test(classification.sanitizedText)) {
    decision.action = 'open_diet_flow';
    decision.depth = 'normal';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if ((state.clarificationCount || 0) >= MAX_CONSECUTIVE_CLARIFICATIONS && classification.confidence >= 0.58) {
    decision.action = 'call_llm_short';
    decision.depth = 'short';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (classification.triage === 'complaint' || classification.triage === 'vent') {
    decision.action = 'local_reply';
    decision.depth = 'short';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (/secar sem perder massa/.test(classification.sanitizedText)) {
    decision.action = 'ask_clarifying';
    decision.topic = 'diet';
    decision.depth = 'micro';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (classification.kind === 'request' && classification.topic === 'workout' && classification.confidence > FLOW_CONFIDENCE_THRESHOLD && /\b(monta|cria|gera|treino\s*\d+x|divisao|ficha)\b/.test(classification.sanitizedText)) {
    decision.action = 'open_workout_flow';
    decision.depth = 'normal';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (classification.kind === 'request' && classification.topic === 'diet' && classification.confidence > FLOW_CONFIDENCE_THRESHOLD && /\b(monta|cria|gera|dieta|plano alimentar)\b/.test(classification.sanitizedText)) {
    decision.action = 'open_diet_flow';
    decision.depth = 'normal';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  if (classification.topic === 'progress' || /\b(progresso|plato|deload|recuperacao|volume)\b/.test(classification.sanitizedText)) {
    decision.action = classification.confidence >= 0.7 ? 'call_agent_tools' : 'ask_clarifying';
    decision.depth = decision.action === 'ask_clarifying' ? 'micro' : 'short';
    decision.tokenLimit = resolveTokenLimit(decision);
    return decision;
  }

  decision.action = decision.depth === 'full' ? 'call_llm_full' : 'call_llm_short';
  decision.tokenLimit = resolveTokenLimit(decision);
  return decision;
}

module.exports = {
  CONFIDENCE_SAFE_THRESHOLD: CONFIDENCE_SAFE_THRESHOLD,
  FLOW_CONFIDENCE_THRESHOLD: FLOW_CONFIDENCE_THRESHOLD,
  MAX_CONSECUTIVE_CLARIFICATIONS: MAX_CONSECUTIVE_CLARIFICATIONS,
  evaluateComplexity: evaluateComplexity,
  decideAction: decideAction,
  resolveTokenLimit: resolveTokenLimit
};
