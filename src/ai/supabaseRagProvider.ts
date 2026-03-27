import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"
import type { RagProvider, RagSearchInput } from "./rag"
import type { RetrievedContextItem } from "./types"
import type { EmbeddingProvider } from "./embeddings"
import { vectorToSqlLiteral } from "./embeddings"

export class SupabaseRagProvider implements RagProvider {
  private readonly supabase: SupabaseClient

  constructor(private readonly embeddingProvider: EmbeddingProvider) {
    this.supabase = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY)
  }

  async search(input: RagSearchInput): Promise<RetrievedContextItem[]> {
    const embedding = await this.embeddingProvider.embedText(input.query)
    const matchCount = input.topK ?? 8

    const { data, error } = await this.supabase.rpc("match_knowledge_chunks", {
      query_embedding: vectorToSqlLiteral(embedding),
      match_count: matchCount,
    })

    if (error) {
      throw new Error(`Erro RAG: ${error.message}`)
    }

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      title: row.title ?? undefined,
      content: String(row.content ?? ""),
      score: typeof row.similarity === "number" ? row.similarity : undefined,
      metadata: row.metadata ?? undefined,
    }))
  }
}
