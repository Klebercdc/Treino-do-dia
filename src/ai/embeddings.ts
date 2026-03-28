import { createClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"

export type EmbeddingVector = number[]

export interface EmbeddingProvider {
  embedText(input: string): Promise<EmbeddingVector>
}

// Dimensão padrão dos embeddings do sistema (text-embedding-3-small / nomic-embed-text-v1.5).
export const EMBEDDING_DIMENSION = 1536

export class PlaceholderEmbeddingProvider implements EmbeddingProvider {
  async embedText(input: string): Promise<EmbeddingVector> {
    // Gera vetor determinístico de EMBEDDING_DIMENSION dimensões.
    // Para uso em desenvolvimento/testes apenas — substitua por provedor real em produção.
    const len = Math.max(1, input.length)
    return Array.from({ length: EMBEDDING_DIMENSION }, (_, i) =>
      ((input.charCodeAt(i % len) || 0) % 97) / 100,
    )
  }
}

export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`
}

export function createServiceSupabase() {
  return createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY)
}
