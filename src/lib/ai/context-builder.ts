import type { IntentType, NutritionContextData, HybridContext, SemanticChunk } from './types';

export function detectIntent(userMessage: string): IntentType {
  const text = userMessage.toLowerCase();
  if (/(plano|dieta|refeiç|cardápio)/.test(text)) return 'diet_current';
  if (/(progresso|evoluç|peso|medidas|hidrata)/.test(text)) return 'progress';
  if (/(suplement|creatina|whey|vitamina|mineral)/.test(text)) return 'supplementation';
  if (/(o que é|como funciona|conceito|explica)/.test(text)) return 'conceptual';
  return 'general';
}

export function contextPriorityForIntent(intent: IntentType): string[] {
  switch (intent) {
    case 'diet_current':
      return ['meal_plans', 'meal_plan_items', 'nutrition_goals', 'profile'];
    case 'progress':
      return ['body_metrics', 'hydration_logs', 'user_food_logs', 'nutrition_goals'];
    case 'supplementation':
      return ['supplement_protocols', 'nutrition_knowledge_chunks', 'profile', 'objective'];
    case 'conceptual':
      return ['nutrition_knowledge_chunks', 'profile'];
    default:
      return ['profile', 'nutrition_goals', 'nutrition_knowledge_chunks'];
  }
}

export function buildHybridContext(input: {
  intent: IntentType;
  structured: NutritionContextData;
  semanticChunks: SemanticChunk[];
}): HybridContext {
  const { intent, structured, semanticChunks } = input;
  const missing: string[] = [];
  if (!structured.profile) missing.push('perfil');
  if (!structured.goals) missing.push('metas nutricionais');
  if (!structured.activePlan.plan) missing.push('plano alimentar ativo');

  const contextSummary = [
    `Prioridades: ${contextPriorityForIntent(intent).join(', ')}`,
    `Chunks semânticos recuperados: ${semanticChunks.length}`,
    missing.length ? `Dados ausentes: ${missing.join(', ')}` : 'Dados principais disponíveis.',
  ].join(' | ');

  return { intent, structured, semanticChunks, contextSummary };
}
