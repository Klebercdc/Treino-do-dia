import { cleanText, detectLanguage, extractEntitiesFromMessage } from './normalizer';
import type { DetectedExerciseContext, ExerciseIntent } from './types';

function computeIntent(message: string): { intent: ExerciseIntent; confidence: number } {
  const msg = cleanText(message);

  const replaceSignals = /(troque|substitua|replace|swap|trocar esse)/.test(msg);
  const variationSignals = /(variacao|variação|variacoes|variations|alternativa)/.test(msg);
  const equipmentSignals = /(com halter|com barra|equipment|equipamento|maquina|machine|kettlebell)/.test(msg);
  const muscleSignals = /(ombro|peito|costas|perna|biceps|triceps|gluteo|shoulder|chest|back|legs|glutes)/.test(msg);
  const exerciseSignals = /(exercicio|exercise|desenvolvimento|supino|agachamento|press|row|curl)/.test(msg);

  if (replaceSignals && (exerciseSignals || muscleSignals)) return { intent: 'exercise_replace', confidence: 0.94 };
  if (variationSignals && (exerciseSignals || muscleSignals)) return { intent: 'exercise_variations', confidence: 0.9 };
  if ((muscleSignals && equipmentSignals) || (exerciseSignals && equipmentSignals)) return { intent: 'exercise_search', confidence: 0.9 };
  if (muscleSignals && /(quero|treino|workout|suger|suggest|mostrar)/.test(msg)) return { intent: 'exercise_by_muscle', confidence: 0.84 };
  if (equipmentSignals && /(quero|treino|workout|suger|suggest|mostrar)/.test(msg)) return { intent: 'exercise_by_equipment', confidence: 0.82 };
  if (exerciseSignals && /(quero|mostrar|me mostre|show me|find)/.test(msg)) return { intent: 'exercise_search', confidence: 0.8 };

  return { intent: 'other', confidence: 0.45 };
}

export function detectIntentFromMessage(message: string): DetectedExerciseContext {
  const normalizedMessage = cleanText(message);
  const base = computeIntent(message);
  const entities = extractEntitiesFromMessage(message);

  return {
    originalMessage: message,
    normalizedMessage,
    intent: base.intent,
    confidence: base.confidence,
    language: detectLanguage(message),
    ...entities,
  };
}
