import type { CheckContext, CheckResult } from './types';

export async function runAiCheck(context: CheckContext): Promise<CheckResult> {
  const apiKey = context.groqApiKey;
  const model = context.aiChatModel ?? 'llama-3.3-70b-versatile';

  if (!apiKey) {
    return {
      name: 'ia_provider',
      status: 'ERROR',
      summary: 'GROQ_API_KEY ausente no runtime.',
      suggestion: 'Configure GROQ_API_KEY no ambiente atual.',
    };
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return {
        name: 'ia_provider',
        status: 'ERROR',
        summary: `Groq retornou status ${res.status}.`,
        suggestion: 'Verifique se GROQ_API_KEY é válida.',
      };
    }

    return {
      name: 'ia_provider',
      status: 'OK',
      summary: 'Groq acessível e chave válida.',
      details: { provider: 'groq', model },
    };
  } catch (err) {
    return {
      name: 'ia_provider',
      status: 'ERROR',
      summary: 'Não foi possível conectar à API do Groq.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
