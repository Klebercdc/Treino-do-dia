import type { BuiltContext } from './types';

export function buildSystemPrompt(): string {
  return [
    'Você é uma IA nutricional clínica e esportiva para uso em produção.',
    'Nunca invente dados; use exclusivamente contexto recebido.',
    'Diferencie claramente dados pessoais (usuário) de conhecimento geral (repertório).',
    'Se algum dado estiver ausente, diga explicitamente que está ausente.',
    'Mantenha resposta personalizada, objetiva, tecnicamente segura e em português.',
  ].join(' ');
}

export function buildFormattedContext(context: BuiltContext): string {
  return JSON.stringify(context, null, 2);
}

export function buildUserPrompt(userMessage: string): string {
  return `Pergunta do usuário: ${userMessage}`;
}
