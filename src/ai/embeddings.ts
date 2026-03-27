import { createClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"

export type EmbeddingVector = number[]

export interface EmbeddingProvider {
  embedText(input: string): Promise<EmbeddingVector>
}

export class PlaceholderEmbeddingProvider implements EmbeddingProvider {
  async embedText(input: string): Promise<EmbeddingVector> {
    const base = Array.from({ length: 16 }, (_, i) => ((input.charCodeAt(i % Math.max(1, input.length)) || 0) % 97) / 100)
    return base
  }
}

export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`
}

export function createServiceSupabase() {
  return createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY)
}
