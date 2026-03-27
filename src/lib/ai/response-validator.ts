import type { BuiltContext } from './types';

export function validateAiResponse(responseText: string, context: BuiltContext): { valid: boolean; output: string; reason?: string } {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return {
      valid: false,
      reason: 'empty',
      output: 'Não consegui gerar uma resposta válida agora. Tente novamente em instantes.',
    };
  }

  const hasContextSignals =
    !!context.profile ||
    context.knowledgeChunks.length > 0 ||
    context.foodLogs.length > 0 ||
    context.planItems.length > 0;

  if (hasContextSignals && !/perfil|plano|meta|hidrata|registro|conhecimento|dados/i.test(trimmed)) {
    return {
      valid: false,
      reason: 'context_ignored',
      output: 'Consegui processar sua pergunta, mas preciso refinar usando seus dados para responder com segurança. Tente novamente.',
    };
  }

  return { valid: true, output: trimmed };
}
