import { createClient } from '@supabase/supabase-js';
import type { CheckContext, CheckResult } from './types';

export async function runVectorCheck(context: CheckContext): Promise<CheckResult> {
  const db = createClient(context.supabaseUrl, context.serviceRoleKey, { auth: { persistSession: false } });
  const dummyEmbedding = Array.from({ length: 1536 }, () => 0.001);

  const { data, error } = await db.rpc('match_nutrition_knowledge', {
    query_embedding: dummyEmbedding,
    match_count: 2,
    category_filter: null,
    tags_filter: null,
  });

  if (error) {
    return {
      name: 'vector_pgvector_rpc',
      status: 'ERROR',
      summary: 'Falha ao executar busca vetorial.',
      error: error.message,
      suggestion: 'Verifique extensão vector, função match_nutrition_knowledge e grants EXECUTE.',
      fix_sql: 'create extension if not exists vector;',
    };
  }

  if (!Array.isArray(data)) {
    return {
      name: 'vector_pgvector_rpc',
      status: 'WARNING',
      summary: 'RPC vetorial respondeu em formato inesperado.',
      details: { dataType: typeof data },
    };
  }

  return {
    name: 'vector_pgvector_rpc',
    status: 'OK',
    summary: 'Busca vetorial e função RPC operacionais.',
    details: { rowsReturned: data.length },
  };
}
