import type { SupabaseClient } from '@supabase/supabase-js';
import type { SemanticChunk } from './types';

export interface RetrievalFilters {
  category?: string;
  tags?: string[];
  sourceType?: string;
  objective?: string;
  dietaryPattern?: string;
  allergies?: string[];
  intolerances?: string[];
}

export async function matchNutritionKnowledge(
  db: SupabaseClient,
  queryEmbedding: number[],
  filters: RetrievalFilters,
  limit = 8,
): Promise<SemanticChunk[]> {
  const { data, error } = await db.rpc('match_nutrition_knowledge', {
    query_embedding: queryEmbedding,
    match_count: Math.max(1, Math.min(limit, 12)),
    category_filter: filters.category ?? null,
    tags_filter: filters.tags?.length ? filters.tags : null,
    source_type_filter: filters.sourceType ?? null,
    objective_filter: filters.objective ?? null,
    dietary_pattern_filter: filters.dietaryPattern ?? null,
    allergies_filter: filters.allergies?.length ? filters.allergies : null,
    intolerances_filter: filters.intolerances?.length ? filters.intolerances : null,
  });

  if (error) throw error;
  return (data ?? []) as SemanticChunk[];
}
