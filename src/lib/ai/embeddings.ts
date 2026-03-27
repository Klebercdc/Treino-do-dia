import { getAIConfig } from '../utils/env';

interface EmbeddingApiResponse {
  data: Array<{ embedding: number[] }>;
}

export async function generateEmbedding(input: string): Promise<number[] | null> {
  const ai = getAIConfig();
  if (!ai.embeddingsEnabled || !ai.chatApiKey || !ai.embeddingModel) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.chatApiKey}`,
    },
    body: JSON.stringify({ model: ai.embeddingModel, input }),
  });

  if (!response.ok) {
    throw new Error(`Embedding provider error: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as EmbeddingApiResponse;
  const embedding = json.data?.[0]?.embedding;
  if (!embedding?.length) throw new Error('Embedding response did not return a valid vector.');
  return embedding;
}

export async function generateEmbeddingsBatch(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];

  const ai = getAIConfig();
  if (!ai.embeddingsEnabled || !ai.chatApiKey || !ai.embeddingModel) {
    return [];
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.chatApiKey}`,
    },
    body: JSON.stringify({ model: ai.embeddingModel, input: chunks }),
  });

  if (!response.ok) throw new Error(`Failed batch embedding generation: ${response.status} ${await response.text()}`);
  const json = (await response.json()) as EmbeddingApiResponse;
  return json.data.map((row) => row.embedding);
}
