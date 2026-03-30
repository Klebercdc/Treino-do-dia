function createDefaultState() {
  return {
    lastIntent: 'unknown',
    lastTopic: 'general',
    awaitingClarification: false,
    clarificationCount: 0,
    lastAction: null,
    lastDepth: 'micro',
    lastUserNeed: null
  };
}

function normalizeState(rawState) {
  var base = createDefaultState();
  var src = rawState && typeof rawState === 'object' ? rawState : {};
  Object.keys(base).forEach(function(k) {
    if (src[k] !== undefined && src[k] !== null) base[k] = src[k];
  });
  return base;
}

function extractShortState(conversationState) {
  if (!conversationState || typeof conversationState !== 'object') return createDefaultState();
  if (conversationState.memory && typeof conversationState.memory === 'object') return normalizeState(conversationState.memory);
  if (!conversationState.mode) return normalizeState(conversationState);
  return createDefaultState();
}

function inferNeed(text, classification) {
  var t = String(text || '').toLowerCase();
  if (/montar|criar|gerar/.test(t)) return 'create';
  if (/ajustar|corrigir|revisar|mudar/.test(t)) return 'adjust';
  if (/duvida|pergunta|entender|explica/.test(t)) return 'question';
  if (/secar|emagrecer|cutting/.test(t)) return 'fat_loss';
  if (/massa|hipertrofia|ganhar/.test(t)) return 'muscle_gain';
  return classification.kind || 'general';
}

function applyContinuationContext(normalizedInput, state) {
  var current = normalizeState(state);
  var text = String((normalizedInput && normalizedInput.reducedText) || '');
  var continuationHit = false;

  if (current.awaitingClarification) {
    continuationHit = /^(sim|nao|montar|o atual|secar|o de treino|mais pra dieta|dieta|treino|ajustar|duvida)$/.test(text) || ((normalizedInput && normalizedInput.tokenCount) || 0) <= 3;
  }

  return {
    continuationHit: continuationHit,
    inheritedTopic: continuationHit ? current.lastTopic : null,
    inheritedNeed: continuationHit ? current.lastUserNeed : null,
    state: current
  };
}

function updateShortState(prevState, classification, decision, userText) {
  var prev = normalizeState(prevState);
  var next = normalizeState(prev);

  next.lastIntent = classification.kind || 'unknown';
  next.lastTopic = classification.topic || prev.lastTopic || 'general';
  next.lastAction = decision.action || null;
  next.lastDepth = decision.depth || 'short';
  next.lastUserNeed = inferNeed(userText, classification);

  var awaiting = decision.action === 'ask_clarifying' || decision.action === 'ask_rephrase';
  next.awaitingClarification = awaiting;

  if (awaiting) next.clarificationCount = (prev.clarificationCount || 0) + 1;
  else next.clarificationCount = 0;

  return next;
}

module.exports = {
  createDefaultState: createDefaultState,
  extractShortState: extractShortState,
  applyContinuationContext: applyContinuationContext,
  updateShortState: updateShortState
};
