import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedCategories = new Set([
  'emagrecimento',
  'hipertrofia',
  'recomposicao_corporal',
  'nutricao_clinica',
  'saude_intestinal',
  'low_carb',
  'jejum_intermitente',
  'diabetes',
  'hipertensao',
  'alimentacao_infantil',
  'alimentacao_da_mulher',
  'alimentacao_do_homem',
  'suplementacao',
  'vitaminas_minerais',
  'estrategias_comportamentais',
  'adesao_ao_plano',
  'educacao_alimentar',
  'substituicoes_alimentares',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitize(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function getEmbeddingKey(): string | undefined {
  return Deno.env.get('GROQ_API_KEY') ?? undefined;
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.filter(Boolean);
}

async function embedChunks(apiKey: string, model: string, chunks: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: chunks }),
  });
  if (!response.ok) throw new Error(`Embedding provider failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  return payload.data.map((item: { embedding: number[] }) => item.embedding);
}

function requireServiceRoleAuthorization(req: Request, serviceRoleKey: string): void {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    throw new Error('Authorization Bearer token is required.');
  }

  const token = header.replace('Bearer ', '').trim();
  if (token !== serviceRoleKey) {
    throw new Error('Only service role key can execute ingestion.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const embeddingKey = getEmbeddingKey();
    const embeddingModel = Deno.env.get('AI_EMBEDDING_MODEL') ?? '';

    if (!url || !serviceRole) return jsonResponse(500, { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.' });

    requireServiceRoleAuthorization(req, serviceRole);

    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json();
    const title = sanitize(String(body.title ?? ''));
    const content = sanitize(String(body.content ?? ''));
    const category = sanitize(String(body.category ?? ''));
    const subcategory = body.subcategory ? sanitize(String(body.subcategory)) : null;
    const tags = Array.isArray(body.tags) ? body.tags.map((tag: string) => sanitize(String(tag))).filter(Boolean) : [];
    const sourceType = body.source_type ? sanitize(String(body.source_type)) : 'manual';
    const sourceReference = body.source_reference ? sanitize(String(body.source_reference)) : `manual://${title.toLowerCase().replace(/\s+/g, '-')}`;

    if (!title || !content || !category) return jsonResponse(400, { error: 'title, content and category are required.' });
    if (!allowedCategories.has(category)) return jsonResponse(400, { error: 'Invalid category for ingestion.' });

    const checksum = await sha256(content);
    const { data: existingDocument, error: duplicateCheckError } = await admin
      .from('nutrition_knowledge_documents')
      .select('id')
      .eq('checksum', checksum)
      .maybeSingle();

    if (duplicateCheckError) return jsonResponse(500, { error: `Duplicate check failed: ${duplicateCheckError.message}` });
    if (existingDocument?.id) {
      return jsonResponse(200, { duplicated: true, documentId: existingDocument.id });
    }

    const { data: existingSource, error: sourceLookupError } = await admin
      .from('nutrition_knowledge_sources')
      .select('id')
      .eq('source_reference', sourceReference)
      .maybeSingle();

    if (sourceLookupError) return jsonResponse(500, { error: `Source lookup failed: ${sourceLookupError.message}` });

    let sourceId = existingSource?.id as string | undefined;
    if (!sourceId) {
      const { data: sourceRow, error: sourceInsertError } = await admin
        .from('nutrition_knowledge_sources')
        .insert({ title, source_type: sourceType, source_reference: sourceReference, category, tags, status: 'active' })
        .select('id')
        .single();

      if (sourceInsertError || !sourceRow) return jsonResponse(500, { error: `Source insert failed: ${sourceInsertError?.message}` });
      sourceId = sourceRow.id;
    }

    const { data: documentRow, error: documentInsertError } = await admin
      .from('nutrition_knowledge_documents')
      .insert({ source_id: sourceId, title, document_text: content, checksum, version: '1.0.0' })
      .select('id')
      .single();

    if (documentInsertError || !documentRow) return jsonResponse(500, { error: `Document insert failed: ${documentInsertError?.message}` });

    const chunks = chunkText(content);
    let embeddingsSkipped = false;
    let embeddings: number[][] = [];

    if (embeddingKey && embeddingModel) {
      embeddings = await embedChunks(embeddingKey, embeddingModel, chunks);
      if (embeddings.length !== chunks.length) {
        return jsonResponse(500, { error: 'Embedding batch length mismatch.' });
      }
    } else {
      embeddingsSkipped = true;
    }

    const chunkRows = chunks.map((chunk, index) => ({
      document_id: documentRow.id,
      source_id: sourceId,
      chunk_index: index,
      content: chunk,
      category,
      subcategory,
      tags,
      metadata: {
        source_type: sourceType,
        source_reference: sourceReference,
        ingestion_at: new Date().toISOString(),
        embeddings_skipped: embeddingsSkipped,
      },
      embedding: embeddingsSkipped ? null : embeddings[index],
    }));

    const { error: chunkInsertError } = await admin.from('nutrition_knowledge_chunks').insert(chunkRows);
    if (chunkInsertError) return jsonResponse(500, { error: `Chunk insert failed: ${chunkInsertError.message}` });

    return jsonResponse(200, {
      ok: true,
      sourceId,
      documentId: documentRow.id,
      chunksInserted: chunkRows.length,
      checksum,
      category,
      tags,
      embeddingsSkipped,
    });
  } catch (error) {
    return jsonResponse(500, { error: (error as Error).message });
  }
});
