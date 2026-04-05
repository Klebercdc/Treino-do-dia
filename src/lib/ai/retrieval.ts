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

  const matchCount = Math.max(1, Math.min(filters.topK ?? 8, 20));

  const { data, error } = await db.rpc('search_nutrition_knowledge', {
    search_query: query,
    match_count: matchCount,
    category_filter: filters.category ?? null,
  });

  if (!error) {
    return normalizeChunks((data ?? []) as KnowledgeChunk[]);
  }

  const lowered = String(query || '').toLowerCase();
  const topicTokens = Array.from(new Set(
    lowered
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  )).slice(0, 8);

  if (!topicTokens.length) return [];

  const orFilter = topicTokens
    .flatMap((token) => [
      `topic.ilike.*${encodeURIComponent(token)}*`,
      `keywords.cs.{"${token.replace(/"/g, '\\"')}"}`
    ])
    .join(',');

  const { data: topics, error: topicsError } = await db
    .from('scientific_topics')
    .select('id,topic,keywords,status')
    .or(orFilter);

  if (topicsError) throw topicsError;

  const topicIds = (topics || [])
    .filter((topic: any) => !topic?.status || String(topic.status).toLowerCase() === 'active')
    .map((topic: any) => topic.id);

  if (!topicIds.length) return [];

  const { data: evidenceRows, error: evidenceError } = await db
    .from('scientific_evidence')
    .select('id,relevance_score,summary,topic:scientific_topics(topic),article:scientific_articles(id,title,journal,doi,pmid)')
    .in('topic_id', topicIds)
    .eq('needs_review', false)
    .order('relevance_score', { ascending: false })
    .limit(matchCount);

  if (evidenceError) throw evidenceError;

  const fallbackRows: KnowledgeChunk[] = (evidenceRows || []).map((row: any, index: number) => ({
    id: String(row.id || `scientific-evidence-${index}`),
    source_id: String(row.article?.pmid || row.article?.doi || row.topic?.topic || 'scientific-evidence'),
    document_id: String(row.article?.id || row.id || `scientific-evidence-${index}`),
    content: String(row.summary || row.article?.title || row.topic?.topic || ''),
    category: 'science_reference',
    subcategory: row.topic?.topic || null,
    tags: row.topic?.topic ? [String(row.topic.topic)] : [],
    metadata: {
      source: 'scientific_evidence',
      journal: row.article?.journal || null,
      doi: row.article?.doi || null,
      pmid: row.article?.pmid || null,
    },
    similarity: Number(row.relevance_score || 0),
  }));

  return normalizeChunks(fallbackRows);
}

export function normalizeChunks(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, tags: chunk.tags ?? [], similarity: Number(chunk.similarity ?? 0) }))
    .sort((a, b) => b.similarity - a.similarity);
}
