import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_CATEGORIES = new Set([
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

const ALLOWED_ORIGINS = [
  'https://kronia.app',
  'https://www.kronia.app',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(req: Request, status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function sanitize(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, 405, { error: 'Method Not Allowed' });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRole) {
      return jsonResponse(req, 500, { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.' });
    }

    requireServiceRoleAuthorization(req, serviceRole);

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, 400, { error: 'Invalid JSON body.' });
    }

    const title = sanitize(String(body.title ?? ''));
    const content = sanitize(String(body.content ?? ''));
    const category = sanitize(String(body.category ?? ''));
    const subcategory = body.subcategory ? sanitize(String(body.subcategory)) : null;
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag: unknown) => sanitize(String(tag))).filter(Boolean)
      : [];
    const sourceType = body.source_type ? sanitize(String(body.source_type)) : 'manual';
    const sourceReference = body.source_reference
      ? sanitize(String(body.source_reference))
      : `manual://${title.toLowerCase().replace(/\s+/g, '-')}`;

    if (!title || !content || !category) {
      return jsonResponse(req, 400, { error: 'title, content and category are required.' });
    }
    if (title.length > 500) {
      return jsonResponse(req, 400, { error: 'title excede 500 caracteres.' });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return jsonResponse(req, 400, { error: 'Invalid category for ingestion.' });
    }

    const checksum = await sha256(content);
    const { data: existingDocument, error: duplicateCheckError } = await admin
      .from('nutrition_knowledge_documents')
      .select('id')
      .eq('checksum', checksum)
      .maybeSingle();

    if (duplicateCheckError) {
      return jsonResponse(req, 500, { error: `Duplicate check failed: ${duplicateCheckError.message}` });
    }
    if (existingDocument?.id) {
      return jsonResponse(req, 200, { duplicated: true, documentId: existingDocument.id });
    }

    const { data: existingSource, error: sourceLookupError } = await admin
      .from('nutrition_knowledge_sources')
      .select('id')
      .eq('source_reference', sourceReference)
      .maybeSingle();

    if (sourceLookupError) {
      return jsonResponse(req, 500, { error: `Source lookup failed: ${sourceLookupError.message}` });
    }

    let sourceId = existingSource?.id as string | undefined;
    if (!sourceId) {
      const { data: sourceRow, error: sourceInsertError } = await admin
        .from('nutrition_knowledge_sources')
        .insert({
          title,
          source_type: sourceType,
          source_reference: sourceReference,
          category,
          tags,
          status: 'active',
        })
        .select('id')
        .single();

      if (sourceInsertError || !sourceRow) {
        return jsonResponse(req, 500, { error: `Source insert failed: ${sourceInsertError?.message}` });
      }
      sourceId = sourceRow.id as string;
    }

    const { data: documentRow, error: documentInsertError } = await admin
      .from('nutrition_knowledge_documents')
      .insert({
        source_id: sourceId,
        title,
        document_text: content,
        checksum,
        version: '1.0.0',
      })
      .select('id')
      .single();

    if (documentInsertError || !documentRow) {
      return jsonResponse(req, 500, { error: `Document insert failed: ${documentInsertError?.message}` });
    }

    const chunks = chunkText(content);
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
      },
      // embedding permanece null até o pipeline de embeddings ser executado
      embedding: null,
    }));

    const { error: chunkInsertError } = await admin
      .from('nutrition_knowledge_chunks')
      .insert(chunkRows);

    if (chunkInsertError) {
      return jsonResponse(req, 500, { error: `Chunk insert failed: ${chunkInsertError.message}` });
    }

    return jsonResponse(req, 200, {
      ok: true,
      sourceId,
      documentId: documentRow.id,
      chunksInserted: chunkRows.length,
      checksum,
      category,
      tags,
      embeddingStatus: 'pending — execute o pipeline de embeddings para ativar a busca semântica',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[INGEST] Erro:', message);
    return jsonResponse(req, 500, { error: message });
  }
});
