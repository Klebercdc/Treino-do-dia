import { getAIConfig } from '../utils/env';
import type { CheckContext, CheckResult } from './types';

export async function runAiCheck(_context: CheckContext): Promise<CheckResult> {
  const ai = getAIConfig();

  if (!ai.chatApiKey) {
    return {
      name: 'ia_provider',
      status: 'ERROR',
      summary: 'GROQ_API_KEY ausente no runtime.',
      suggestion: 'Configure GROQ_API_KEY no ambiente atual.',
    };
  }

  return {
    name: 'ia_provider',
    status: ai.embeddingsEnabled ? 'OK' : 'WARNING',
    summary: ai.embeddingsEnabled ? 'Groq configurado com chat e embeddings.' : 'Groq configurado para chat; embeddings opcionais estão desabilitados.',
    details: {
      provider: ai.provider,
      chatModel: ai.chatModel,
      embeddingModel: ai.embeddingModel ?? null,
    },
  };
}
