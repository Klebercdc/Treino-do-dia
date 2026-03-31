const INTENTS = [
  'GREETING',
  'WORKOUT_CREATE',
  'WORKOUT_ADJUST',
  'WORKOUT_ANALYZE',
  'DIET_CREATE',
  'DIET_ADJUST',
  'DIET_ANALYZE',
  'SUPPLEMENT_PROTOCOL',
  'PROGRESS_REVIEW',
  'RECOVERY_SUPPORT',
  'ROUTINE_ORGANIZATION',
  'PLAN_QUESTION',
  'BILLING_QUESTION',
  'OTHER',
];

const KEYWORDS = {
  GREETING: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'],
  WORKOUT_CREATE: ['treino', 'ficha', 'periodização', 'periodizacao', 'montar treino', 'criar treino'],
  WORKOUT_ADJUST: ['ajustar treino', 'ajuste treino', 'mudar treino', 'trocar exercício', 'trocar exercicio'],
  WORKOUT_ANALYZE: ['analisar treino', 'análise de treino', 'analise de treino', 'volume de treino', 'pr de treino'],
  DIET_CREATE: ['dieta', 'plano alimentar', 'cardápio', 'cardapio', 'criar dieta'],
  DIET_ADJUST: ['ajustar dieta', 'ajuste dieta', 'mudar dieta', 'trocar refeição', 'trocar refeicao'],
  DIET_ANALYZE: ['analisar dieta', 'análise dieta', 'analise dieta', 'macros', 'calorias'],
  SUPPLEMENT_PROTOCOL: ['suplemento', 'creatina', 'whey', 'vitamina', 'protocolo'],
  PROGRESS_REVIEW: ['progresso', 'evolução', 'evolucao', 'resultado', 'plateau', 'platô'],
  RECOVERY_SUPPORT: ['recuperação', 'recuperacao', 'fadiga', 'dor', 'sono', 'deload'],
  ROUTINE_ORGANIZATION: ['rotina', 'agenda', 'organizar semana', 'planejar semana'],
  PLAN_QUESTION: ['plano', 'free', 'pro', 'ultra', 'upgrade'],
  BILLING_QUESTION: ['cobrança', 'cobranca', 'fatura', 'pagamento', 'cartão', 'cartao', 'assinatura'],
};

function normalizeMessage(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectDomain(intent) {
  if (intent.startsWith('WORKOUT')) return 'workout';
  if (intent.startsWith('DIET')) return 'diet';
  if (intent === 'SUPPLEMENT_PROTOCOL') return 'supplement';
  if (intent === 'PROGRESS_REVIEW') return 'progress';
  if (intent === 'PLAN_QUESTION' || intent === 'BILLING_QUESTION') return 'billing';
  if (intent === 'RECOVERY_SUPPORT' || intent === 'ROUTINE_ORGANIZATION') return 'profile';
  return 'general';
}

function classifyIntent(rawMessage) {
  const message = normalizeMessage(rawMessage);

  if (!message) {
    return { intent: 'OTHER', confidence: 0.2, needs_clarification: true, domain: 'general' };
  }

  for (const [intent, terms] of Object.entries(KEYWORDS)) {
    if (terms.some((term) => matchesTerm(message, term))) {
      const confidence = message.length < 10 ? 0.72 : 0.9;
      return {
        intent,
        confidence,
        needs_clarification: confidence < 0.75,
        domain: detectDomain(intent),
      };
    }
  }

  return { intent: 'OTHER', confidence: 0.5, needs_clarification: true, domain: 'general' };
}

function matchesTerm(message, term) {
  if (term.includes(' ')) return message.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

module.exports = {
  INTENTS,
  normalizeMessage,
  classifyIntent,
};
