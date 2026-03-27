import type { RetrievalIntent } from './types';

const intentPatterns: Array<[RetrievalIntent, RegExp]> = [
  ['current_diet', /(plano|dieta|card[aá]pio|refeiç)/i],
  ['progress_analysis', /(progresso|evolu|resultado|semana|m[eé]trica)/i],
  ['supplementation', /(suplement|creatina|whey|vitamina|mineral|dose)/i],
  ['meal_adjustment', /(ajuste|trocar|substitu|adapta[r]? refeiç)/i],
  ['hydration', /(hidrata|[áa]gua|water|ml)/i],
  ['body_composition', /(gordura|massa magra|composiç|circunfer|peso)/i],
  ['general_nutrition_question', /(nutri|caloria|macro|micro|alimento|metabolismo)/i],
];

export function detectIntent(message: string): RetrievalIntent {
  for (const [intent, regex] of intentPatterns) {
    if (regex.test(message)) return intent;
  }
  return 'fallback';
}
