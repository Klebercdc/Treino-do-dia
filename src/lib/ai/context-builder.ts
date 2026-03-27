import type { BuiltContext, RetrievalIntent } from './types';

export function buildContextSummary(context: BuiltContext): string {
  return [
    `intent=${context.intent}`,
    `profile=${context.profile ? 'yes' : 'no'}`,
    `goals=${context.goals ? 'yes' : 'no'}`,
    `plan_items=${context.planItems.length}`,
    `food_logs=${context.foodLogs.length}`,
    `hydration_logs=${context.hydrationLogs.length}`,
    `body_metrics=${context.bodyMetrics.length}`,
    `supplements=${context.supplements.length}`,
    `knowledge_chunks=${context.knowledgeChunks.length}`,
  ].join(' | ');
}

export function prioritizeByIntent(intent: RetrievalIntent): string[] {
  if (intent === 'current_diet') return ['profile', 'nutrition_goals', 'meal_plans', 'meal_plan_items'];
  if (intent === 'progress_analysis') return ['body_metrics', 'user_food_logs', 'hydration_logs', 'nutrition_goals'];
  if (intent === 'supplementation') return ['supplement_protocols', 'profiles', 'nutrition_knowledge_chunks'];
  if (intent === 'general_nutrition_question') return ['nutrition_knowledge_chunks', 'profiles'];
  if (intent === 'hydration') return ['hydration_logs', 'nutrition_goals', 'profiles'];
  if (intent === 'body_composition') return ['body_metrics', 'nutrition_goals', 'profiles'];
  return ['profiles', 'nutrition_goals', 'nutrition_knowledge_chunks'];
}

export function buildFinalContext(context: Omit<BuiltContext, 'contextSummary'>): BuiltContext {
  const withSummary: BuiltContext = {
    ...context,
    contextSummary: '',
  };
  withSummary.contextSummary = `${buildContextSummary(withSummary)} | priority=${prioritizeByIntent(withSummary.intent).join(',')}`;
  return withSummary;
}
