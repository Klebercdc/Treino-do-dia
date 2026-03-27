import type { SupabaseClient } from '@supabase/supabase-js';
import type { KnowledgeChunk } from './types';

export interface RetrievalFilters {
  category?: string;
  topK?: number;
}

export async function retrieveKnowledgeChunks(
  db: SupabaseClient,
  query: string,
  filters: RetrievalFilters = {},
): Promise<KnowledgeChunk[]> {
  if (!query.trim()) return [];

  const { data, error } = await db.rpc('search_nutrition_knowledge', {
    search_query: query,
    match_count: Math.max(1, Math.min(filters.topK ?? 8, 20)),
    category_filter: filters.category ?? null,
  });

  if (error) throw error;
  return normalizeChunks((data ?? []) as KnowledgeChunk[]);
}

export function normalizeChunks(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, tags: chunk.tags ?? [], similarity: Number(chunk.similarity ?? 0) }))
    .sort((a, b) => b.similarity - a.similarity);
}
