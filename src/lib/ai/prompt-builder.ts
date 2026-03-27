import type { HybridContext } from './types';

export const INTERNAL_SYSTEM_PROMPT = `Você é uma IA nutricional contextual para app clínico/esportivo.
Antes de responder, considere perfil, metas, plano alimentar, registros recentes, suplementação e repertório vetorial.
Nunca invente dados. Quando faltar informação, diga explicitamente.
Diferencie recomendação geral de dado pessoal.
Responda com linguagem profissional, clara, objetiva e útil para app mobile.
Priorize segurança, adesão e consistência com dados do banco.`;

export function buildSystemPrompt(context: HybridContext): string {
  const c = context;
  return [
    INTERNAL_SYSTEM_PROMPT,
    `INTENÇÃO IDENTIFICADA: ${c.intent}`,
    `RESUMO CONTEXTUAL: ${c.contextSummary}`,
    `PERFIL: ${JSON.stringify(c.structured.profile ?? {})}`,
    `METAS: ${JSON.stringify(c.structured.goals ?? {})}`,
    `PLANO ATIVO: ${JSON.stringify(c.structured.activePlan ?? {})}`,
    `REGISTROS RECENTES: ${JSON.stringify({
      meals: c.structured.recentMeals,
      hydration: c.structured.hydration,
      bodyMetrics: c.structured.bodyMetrics,
      supplements: c.structured.supplements,
    })}`,
    `TRECHOS SEMÂNTICOS RELEVANTES: ${JSON.stringify(
      c.semanticChunks.map((chunk) => ({
        similarity: chunk.similarity,
        category: chunk.category,
        tags: chunk.tags,
        content: chunk.content,
      })),
    )}`,
  ].join('\n\n');
}
