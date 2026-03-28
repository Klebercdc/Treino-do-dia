import type { EmbeddingProvider, EmbeddingVector } from "./embeddings"
import { EMBEDDING_DIMENSION } from "./embeddings"

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model = "text-embedding-3-small") {
    this.apiKey = apiKey
    this.model = model
  }

  async embedText(input: string): Promise<EmbeddingVector> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: input.slice(0, 8191), // limite do modelo
        dimensions: EMBEDDING_DIMENSION,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`OpenAI Embeddings error: ${res.status} ${text}`)
    }

    const json = await res.json()
    const vector: number[] | undefined = json?.data?.[0]?.embedding

    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error("OpenAI Embeddings não retornou vetor válido")
    }

    return vector
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()

  if (openAiKey) {
    return new OpenAIEmbeddingProvider(openAiKey)
  }

  // Fallback para desenvolvimento — não usar em produção com RAG real
  const { PlaceholderEmbeddingProvider } = require("./embeddings")
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[KroniaAI] OPENAI_API_KEY não configurada — usando PlaceholderEmbeddingProvider. " +
      "A busca semântica RAG não funcionará corretamente em produção.",
    )
  }
  return new PlaceholderEmbeddingProvider()
}
