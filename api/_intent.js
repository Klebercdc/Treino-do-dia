/**
 * _intent.js — BLOCO 1
 * Detecção de intenção + extração segura de mensagem.
 *
 * detectIntent(message) retorna SOMENTE: 'greeting' | 'workout' | 'diet' | 'general'
 * safeExtractLastUserMessage(messages) nunca lança exceção.
 */

// ─── Normalização ────────────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// ─── safeExtractLastUserMessage ──────────────────────────────────────────────
// Defensivo: aceita arrays inválidos, objetos fora do padrão, conteúdo ausente.
// Nunca lança. Retorna string segura ou string vazia.

function safeExtractLastUserMessage(messages) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return '';
    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      if (!m || typeof m !== 'object') continue;
      if (String(m.role || '') !== 'user') continue;
      var c = m.content;
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (Array.isArray(c)) {
        for (var j = 0; j < c.length; j++) {
          var part = c[j];
          if (part && typeof part === 'object' && typeof part.text === 'string' && part.text.trim()) {
            return part.text.trim();
          }
          if (typeof part === 'string' && part.trim()) return part.trim();
        }
      }
    }
  } catch (e) { /* nunca quebra */ }
  return '';
}

// ─── Padrões de saudação ─────────────────────────────────────────────────────
// Até 4 palavras. Cobre: oi, olá, opa, e aí, eae, hey, hello, bom dia,
// boa tarde, boa noite, oi tudo bem, olá tudo bem e variações curtas.

var GREETING_PATTERNS = [
  /^(oi|ola|opa|hey|hello|hi)([!?.,]*)$/,
  /^(oi|ola|opa|hey|hello|hi)\s+tudo\s*(bem|bom|certo|ok|otimo|ótimo)?[!?.,]*$/,
  /^e\s*[aai][ie]?[!?.,]*$/,
  /^eae[!?.,]*$/,
  /^bom\s+dia[!?.,]*$/,
  /^boa\s+tarde[!?.,]*$/,
  /^boa\s+noite[!?.,]*$/,
  /^(ol[aá]|oi)\s+(kronos|kronia|ia|bot|ai)[!?.,]*$/,
  /^(hey|hi)\s+(kronos|kronia|ia|bot|ai)[!?.,]*$/,
  /^tudo\s*(bem|bom|certo|ok)[!?,]*$/,
  /^(oi|ola|opa)\s+bom\s+dia[!?.,]*$/,
  /^(oi|ola|opa)\s+boa\s+tarde[!?.,]*$/,
  /^(oi|ola|opa)\s+boa\s+noite[!?.,]*$/,
];

// ─── Padrões de workout ───────────────────────────────────────────────────────
// Requer verbo de intenção clara + alvo de treino.
// NÃO dispara só porque "treino" apareceu numa frase casual.

var WORKOUT_PATTERNS = [
  // verbo de pedido + treino/ficha/programa
  /\b(cri[ae]|criar|ger[ae]|gerar|mont[ae]|montar|elabor[ae]|elaborar|faz[ae]|fazer|quero|preciso|me\s+d[aá]|me\s+mand[ae]|me\s+pass[ae]|sugir[ae]|sugerir|revis[ae]|revisar|ajust[ae]|ajustar|muda|mud[ae])\b.{0,50}\b(treino|ficha|programa|plano|divisao|divisão|rotina)\b/,
  // treino de grupo muscular específico
  /\btreino\s+de\s+(peito|costas|pernas|ombro|ombros|braco|bracos|biceps|triceps|gluteo|gluteos|panturrilha|abdomen|abdominais|full\s*body|empurrar|puxar|hipertrofia|forca|resistencia)\b/,
  // ficha de treino direto
  /\bficha\s+de\s+treino\b/,
  // monta/gera meu treino
  /\b(monte|monta|gere|gera|faz|faça|crie|cria)\b.{0,20}\b(meu|um|minha|meus)\b.{0,20}\b(treino|ficha|programa|plano)\b/,
  // me ajuda com o treino (com verbo de ação)
  /\b(ajusta|ajuste|ajustar|revisa|revise|revisar|muda|mude|mudar|atualiza|atualize)\b.{0,30}\b(meu|o|minha)\b.{0,20}\b(treino|ficha|programa|plano)\b/,
];

// ─── Padrões de diet ──────────────────────────────────────────────────────────
// Requer verbo de intenção clara + alvo de dieta/alimentação.
// NÃO dispara só porque "dieta" apareceu numa frase casual.

var DIET_PATTERNS = [
  // verbo de pedido + dieta/cardápio/plano alimentar
  /\b(cri[ae]|criar|ger[ae]|gerar|mont[ae]|montar|elabor[ae]|elaborar|faz[ae]|fazer|quero|preciso|me\s+d[aá]|me\s+mand[ae]|me\s+pass[ae]|monta|monte)\b.{0,50}\b(dieta|cardapio|plano\s+alimentar|alimentacao|refeicoes|cardápio)\b/,
  // dieta para objetivo
  /\bdieta\s+(para|pra)\s+(secar|emagrecer|hipertrofia|ganhar|massa|perder|definir|bulking|cutting|manutencao)\b/,
  // plano alimentar / cardápio semanal
  /\b(plano\s+alimentar|cardapio\s+semanal|cardápio\s+semanal)\b/,
  // calcular calorias/macros (com verbo)
  /\b(calcula|calcule|calcular|me\s+calcula|me\s+calcule)\b.{0,30}\b(calorias|kcal|macros|proteinas|tdee|tmb)\b/,
  // quero saber minhas calorias / macros
  /\b(quero\s+(saber|conhecer)|me\s+(diz|fala|passa))\b.{0,30}\b(meus\s+macros|minhas\s+calorias|meu\s+tdee|meu\s+tmb)\b/,
];

// ─── detectIntent ─────────────────────────────────────────────────────────────
// Retorna exatamente um de: 'greeting' | 'workout' | 'diet' | 'general'
// Lógica: síncrona, barata, sem dependência externa.

function detectIntent(message) {
  var msg = normalizeText(message);
  if (!msg) return 'general';

  // 1. Greeting — só para frases curtas (≤ 5 palavras)
  var wordCount = msg.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 5) {
    for (var g = 0; g < GREETING_PATTERNS.length; g++) {
      if (GREETING_PATTERNS[g].test(msg)) return 'greeting';
    }
  }

  // 2. Workout — requer intenção clara
  for (var w = 0; w < WORKOUT_PATTERNS.length; w++) {
    if (WORKOUT_PATTERNS[w].test(msg)) return 'workout';
  }

  // 3. Diet — requer intenção clara
  for (var d = 0; d < DIET_PATTERNS.length; d++) {
    if (DIET_PATTERNS[d].test(msg)) return 'diet';
  }

  return 'general';
}

// ─── Helpers legados (backward compatibility com chat.js e usos externos) ─────

var EXERCISE_DISCOVERY_PATTERNS_LEGACY = [
  'exercicio de ', 'exercicio para ', 'exercicios de ', 'exercicios para ',
  'me mostra ', 'me mostre ', 'mostra um exercicio', 'mostre um exercicio',
  'troque esse exercicio', 'substitua esse exercicio', 'trocar exercicio',
  'variacoes de ', 'variações de ', 'variacao de ',
  'como fazer ', 'como executar ',
  'substituto para ', 'alternativa para '
];

var DIET_START_PATTERNS_LEGACY = [
  'faca uma dieta', 'monta uma dieta', 'monte uma dieta',
  'crie uma dieta', 'quero dieta', 'quero uma dieta',
  'plano alimentar', 'me manda uma dieta', 'me da uma dieta'
];

function isDietStart(message) {
  var msg = normalizeText(message);
  return DIET_START_PATTERNS_LEGACY.some(function(p) { return msg.includes(p); });
}

function isExerciseDiscovery(message) {
  var msg = normalizeText(message);
  return EXERCISE_DISCOVERY_PATTERNS_LEGACY.some(function(p) { return msg.includes(p); });
}

module.exports = {
  safeExtractLastUserMessage: safeExtractLastUserMessage,
  detectIntent:               detectIntent,
  isDietStart:                isDietStart,
  isExerciseDiscovery:        isExerciseDiscovery,
  normalizeText:              normalizeText
};
