/**
 * Detecção de intenção — KRONOS
 * Analisa a mensagem e retorna o tipo de intent.
 */

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

var DIET_KEYWORDS    = ['dieta', 'alimentacao', 'cardapio', 'plano alimentar', 'comer', 'refeicao', 'calorias', 'macros', 'kcal'];
var WORKOUT_KEYWORDS = ['treino', 'treinar', 'academia', 'exercicio', 'periodizacao', 'hipertrofia', 'ficha'];
var SUPPLEMENT_KEYWORDS = ['suplemento', 'creatina', 'whey', 'pre treino', 'cafeina', 'multivitaminico', 'bcaa', 'glutamina'];

var DIET_START_PATTERNS = [
  'faca uma dieta', 'monta uma dieta', 'monte uma dieta',
  'crie uma dieta', 'quero dieta', 'quero uma dieta',
  'plano alimentar', 'me manda uma dieta', 'me da uma dieta'
];

var WORKOUT_START_PATTERNS = [
  'faca um treino', 'monta um treino', 'monte um treino',
  'crie um treino', 'quero um treino', 'ficha de treino',
  'me manda um treino', 'me da um treino'
];

function detectIntent(message) {
  var msg = normalizeText(message);
  var score = { diet_request: 0, workout_request: 0, supplement_request: 0 };

  DIET_KEYWORDS.forEach(function(k)       { if (msg.includes(k)) score.diet_request       += 2; });
  WORKOUT_KEYWORDS.forEach(function(k)    { if (msg.includes(k)) score.workout_request    += 2; });
  SUPPLEMENT_KEYWORDS.forEach(function(k) { if (msg.includes(k)) score.supplement_request += 2; });

  DIET_START_PATTERNS.forEach(function(k)    { if (msg.includes(k)) score.diet_request    += 5; });
  WORKOUT_START_PATTERNS.forEach(function(k) { if (msg.includes(k)) score.workout_request += 5; });

  var entries = Object.keys(score).map(function(k) { return [k, score[k]]; });
  entries.sort(function(a, b) { return b[1] - a[1]; });

  if (!entries[0] || entries[0][1] < 2) return 'general_chat';
  return entries[0][0];
}

function isDietStart(message) {
  var msg = normalizeText(message);
  return DIET_START_PATTERNS.some(function(p) { return msg.includes(p); });
}

module.exports = { detectIntent: detectIntent, isDietStart: isDietStart };
