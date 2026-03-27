import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CheckResult, RuntimeContext } from './types';

const EMBEDDING_DIM = 1536;

function buildVector(seed = 0.01): number[] {
  return Array.from({ length: EMBEDDING_DIM }, (_, i) => (i % 32 === 0 ? seed : 0));
}

function asVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

async function generateEmbedding(runtime: RuntimeContext, text: string): Promise<number[]> {
  if (!runtime.checkContext.aiApiKey) throw new Error('AI_API_KEY ausente para teste semântico.');

  const response = await fetch(`${runtime.checkContext.aiApiUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.checkContext.aiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: runtime.checkContext.aiEmbeddingModel, input: text }),
  });

  if (!response.ok) {
    throw new Error(`Falha provider embeddings: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const embedding = payload.data?.[0]?.embedding as number[] | undefined;
  if (!embedding?.length) throw new Error('Embedding vazio recebido do provider.');
  return embedding;
}

export async function runVectorChecks(runtime: RuntimeContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const service = createClient(runtime.checkContext.supabaseUrl, runtime.checkContext.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  results.push(await checkVectorExtension(service));
  results.push(await checkEmbeddingColumn(service));
  results.push(await runVectorInsertAndSimilarity(runtime, service));
  results.push(await runSemanticSearchTest(runtime, service));

  return results;
}

async function checkVectorExtension(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const { data, error } = await service
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')
      .maybeSingle();

    if (error) throw error;

    return {
      step: '6. Teste de embeddings/vetor (extensão)',
      status: data ? 'OK' : 'ERROR',
      description: data ? 'Extensão vector ativa.' : 'Extensão vector não encontrada.',
      suggestion: data ? undefined : 'Execute CREATE EXTENSION IF NOT EXISTS vector;',
      suggestedSql: data ? undefined : 'CREATE EXTENSION IF NOT EXISTS vector;',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '6. Teste de embeddings/vetor (extensão)',
      status: 'ERROR',
      description: 'Falha ao validar pg_extension.',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function checkEmbeddingColumn(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const { data, error } = await service
      .from('information_schema.columns')
      .select('table_name,column_name,udt_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'nutrition_knowledge_chunks')
      .eq('column_name', 'embedding')
      .maybeSingle();

    if (error) throw error;
    const isVector = (data?.udt_name as string | undefined) === 'vector';

    return {
      step: '6. Teste de embeddings/vetor (coluna)',
      status: isVector ? 'OK' : 'ERROR',
      description: isVector ? 'Coluna embedding encontrada com tipo vector.' : 'Coluna embedding ausente ou tipo inválido.',
      details: { udtName: data?.udt_name },
      suggestion: isVector ? undefined : 'Ajuste migration para embedding vector(1536).',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '6. Teste de embeddings/vetor (coluna)',
      status: 'ERROR',
      description: 'Falha ao validar coluna embedding.',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function runVectorInsertAndSimilarity(runtime: RuntimeContext, service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const sourceTitle = `System Check Source ${Date.now()}`;

    const { data: source, error: sourceError } = await service
      .from('nutrition_knowledge_sources')
      .insert({
        title: sourceTitle,
        source_type: 'system_check',
        category: 'emagrecimento',
        status: 'active',
        tags: ['system-check'],
      })
      .select('id')
      .single();
    if (sourceError || !source) throw sourceError ?? new Error('Falha ao inserir source de teste.');

    const { data: document, error: docError } = await service
      .from('nutrition_knowledge_documents')
      .insert({
        source_id: source.id,
        title: 'Documento system-check',
        document_text: 'Documento de validação vetorial para emagrecimento.',
        checksum: `system-check-${Date.now()}`,
        version: 'v1',
      })
      .select('id')
      .single();
    if (docError || !document) throw docError ?? new Error('Falha ao inserir documento de teste.');

    const embedding = buildVector(0.02);
    const { data: chunk, error: chunkError } = await service
      .from('nutrition_knowledge_chunks')
      .insert({
        source_id: source.id,
        document_id: document.id,
        chunk_index: 0,
        content: 'Para emagrecer, manter déficit calórico com ingestão proteica adequada ajuda na adesão.',
        category: 'emagrecimento',
        tags: ['system-check', 'emagrecimento'],
        metadata: { objectives: ['emagrecimento'] },
        embedding: asVectorLiteral(embedding),
      })
      .select('id')
      .single();

    if (chunkError || !chunk) throw chunkError ?? new Error('Falha ao inserir chunk com embedding.');

    runtime.state.vectorTestSourceId = source.id;
    runtime.state.vectorTestDocumentId = document.id;
    runtime.state.vectorTestChunkId = chunk.id;

    const { data: matches, error: matchError } = await service.rpc('match_nutrition_knowledge', {
      query_embedding: embedding,
      match_count: 3,
      category_filter: 'emagrecimento',
      tags_filter: ['system-check'],
      source_type_filter: 'system_check',
      objective_filter: 'emagrecimento',
      dietary_pattern_filter: null,
      allergies_filter: null,
      intolerances_filter: null,
    });
    if (matchError) throw matchError;

    const found = (matches ?? []).some((row: { id: string }) => row.id === chunk.id);

    return {
      step: '6. Teste de embeddings/vetor (insert + similarity)',
      status: found ? 'OK' : 'WARNING',
      description: found
        ? 'Inserção vetorial e busca por similaridade executadas com sucesso.'
        : 'Busca por similaridade executou, mas não retornou o chunk recém inserido.',
      details: { insertedChunkId: chunk.id, resultCount: (matches ?? []).length },
      suggestion: found ? undefined : 'Ajuste parâmetros do índice vetorial e ANALYZE da tabela de chunks.',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '6. Teste de embeddings/vetor (insert + similarity)',
      status: 'ERROR',
      description: 'Falha ao validar inserção vetorial e busca de similaridade.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique integridade de source/document/chunk e tipo do campo embedding.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function runSemanticSearchTest(runtime: RuntimeContext, service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    if (!runtime.checkContext.aiApiKey) {
      return {
        step: '7. Teste de busca semântica',
        status: 'WARNING',
        description: 'AI_API_KEY ausente; teste semântico pulado.',
        suggestion: 'Defina AI_API_KEY para testar geração real de embeddings.',
        durationMs: Date.now() - startedAt,
      };
    }

    const embedding = await generateEmbedding(runtime, 'como emagrecer');
    const { data, error } = await service.rpc('match_nutrition_knowledge', {
      query_embedding: embedding,
      match_count: 5,
      category_filter: 'emagrecimento',
      tags_filter: null,
      source_type_filter: null,
      objective_filter: 'emagrecimento',
      dietary_pattern_filter: null,
      allergies_filter: null,
      intolerances_filter: null,
    });

    if (error) throw error;
    const hasResults = (data ?? []).length > 0;

    return {
      step: '7. Teste de busca semântica',
      status: hasResults ? 'OK' : 'WARNING',
      description: hasResults
        ? 'Busca semântica retornou chunks relevantes para "como emagrecer".'
        : 'Busca semântica executou, mas sem resultados.',
      details: {
        question: 'como emagrecer',
        resultCount: (data ?? []).length,
        firstResult: data?.[0] ?? null,
      },
      suggestion: hasResults ? undefined : 'Ingerir mais conteúdo em categoria emagrecimento e garantir status=active.',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '7. Teste de busca semântica',
      status: 'ERROR',
      description: 'Falha ao executar busca semântica real.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique AI_API_KEY, modelo de embedding e função RPC match_nutrition_knowledge.',
      durationMs: Date.now() - startedAt,
    };
  }
}
