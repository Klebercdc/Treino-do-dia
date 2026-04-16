function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function safeExtractLastUserMessage(messages) {
  if (!Array.isArray(messages) || !messages.length) return '';

  for (var i = messages.length - 1; i >= 0; i--) {
    var msg = messages[i];
    if (!msg || typeof msg !== 'object') continue;
    if (String(msg.role || '').toLowerCase() !== 'user') continue;

    var content = msg.content;
    if (typeof content === 'string') return content.trim();

    if (Array.isArray(content)) {
      var merged = content.map(function(part) {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        if (part && part.content && typeof part.content === 'string') return part.content;
        return '';
      }).join(' ').trim();
      if (merged) return merged;
    }

    if (content && typeof content === 'object') {
      if (typeof content.text === 'string') return content.text.trim();
      if (typeof content.content === 'string') return content.content.trim();
    }
  }
  return '';
}

var GREETING_REGEX = /^(oi+|ola+|ol[áa]|opa|e ai|eae|hey|hello|bom dia|boa tarde|boa noite)(\b.*)?$/i;
var WORKOUT_REQUEST = /\b(treino|ficha|divisao|rotina de treino|exercicio|musculacao|programa)\b/i;
var DIET_REQUEST = /\b(dieta|plano alimentar|cardapio|alimentacao|refeicoes|macros?|calorias?|nutricao)\b/i;
var EXPLICIT_FLOW_VERB = /\b(montar|monta|monte|criar|cria|crie|gerar|gera|gere|fazer|faz|faca|abrir|abre|ajustar|ajusta|ajuste|continuar|continua|continue|revisar|revisa|revise)\b/i;
var EXPLICIT_FLOW_PREFIX = /\b(quero|preciso|pode|consegue|vamos|bora|me ajuda a|me ajuda com)\b/i;

function hasExplicitFlowIntent(message) {
  if (!message) return false;
  if (/\bcomo\s+fazer\b/i.test(message)) return false;
  if (EXPLICIT_FLOW_VERB.test(message)) return true;
  return EXPLICIT_FLOW_PREFIX.test(message) && /\b(treino|ficha|programa|dieta|plano alimentar|cardapio|macros?)\b/i.test(message);
}

function detectIntent(message) {
  var raw = String(message || '');
  var msg = normalizeText(raw);
  if (!msg) return 'general';

  var words = msg.split(' ').filter(Boolean);
  if (words.length <= 4 && GREETING_REGEX.test(msg)) return 'greeting';
  if (/^(oi|ola|olá)\s+tudo bem/.test(msg)) return 'greeting';

  if (hasExplicitFlowIntent(msg) && WORKOUT_REQUEST.test(msg)) return 'workout';
  if (hasExplicitFlowIntent(msg) && DIET_REQUEST.test(msg)) return 'diet';
  return 'general';
}

function isDietStart(message) {
  return detectIntent(message) === 'diet';
}

function isExerciseDiscovery(message) {
  var msg = normalizeText(message);
  return /(exercicio|exercicios)\s+(de|para)\b|como (fazer|executar)\b|substitu(a|ir)\s+.*exercicio/.test(msg);
}

module.exports = {
  safeExtractLastUserMessage: safeExtractLastUserMessage,
  detectIntent: detectIntent,
  isDietStart: isDietStart,
  isExerciseDiscovery: isExerciseDiscovery
};
