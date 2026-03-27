import type { SupabaseClient } from '@supabase/supabase-js';
import type { KnowledgeChunk } from './types';

export interface RetrievalFilters {
  category?: string;
  tags?: string[];
  topK?: number;
}

export async function retrieveKnowledgeChunks(
  db: SupabaseClient,
  queryEmbedding: number[] | null,
  filters: RetrievalFilters = {},
): Promise<KnowledgeChunk[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  const { data, error } = await db.rpc('match_nutrition_knowledge', {
    query_embedding: queryEmbedding,
    match_count: Math.max(1, Math.min(filters.topK ?? 8, 20)),
    category_filter: filters.category ?? null,
    tags_filter: filters.tags?.length ? filters.tags : null,
  });

  if (error) throw error;
  return normalizeChunks((data ?? []) as KnowledgeChunk[]);
}

export function normalizeChunks(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, tags: chunk.tags ?? [], similarity: Number(chunk.similarity ?? 0) }))
    .sort((a, b) => b.similarity - a.similarity);
}
