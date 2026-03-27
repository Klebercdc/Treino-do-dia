import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface IngestDocument {
  title: string;
  text: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  version?: string;
}

interface IngestPayload {
  source: {
    id?: string;
    title: string;
    sourceType: string;
    sourceReference?: string;
    category?: string;
    tags?: string[];
    language?: string;
    status?: 'draft' | 'active' | 'archived';
  };
  documents: IngestDocument[];
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AI_API_KEY = Deno.env.get('AI_API_KEY') ?? '';
const AI_EMBEDDING_MODEL = Deno.env.get('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
const AI_API_URL = Deno.env.get('AI_API_URL') ?? 'https://api.openai.com/v1';
const CHUNK_SIZE = Number(Deno.env.get('INGEST_CHUNK_SIZE') ?? '900');
const CHUNK_OVERLAP = Number(Deno.env.get('INGEST_CHUNK_OVERLAP') ?? '120');

function normalizeContent(text: string): string {
  return text.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const normalized = normalizeContent(text);
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function embedMany(inputs: string[]): Promise<number[][]> {
  const response = await fetch(`${AI_API_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: AI_EMBEDDING_MODEL, input: inputs }),
  });

  if (!response.ok) {
    throw new Error(`Embedding provider error: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return (payload.data ?? []).map((row: { embedding: number[] }) => row.embedding);
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AI_API_KEY) {
      throw new Error('Env vars obrigatórias ausentes.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization ausente' }), { status: 401 });
    }

    // Requer service role para ingestão administrativa.
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Apenas backend administrativo pode ingerir repertório' }), { status: 403 });
    }

    const payload = (await req.json()) as IngestPayload;
    if (!payload?.source?.title || !payload?.source?.sourceType || !payload.documents?.length) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let sourceId = payload.source.id;
    if (!sourceId) {
      const { data: source, error } = await admin
        .from('nutrition_knowledge_sources')
        .insert({
          title: payload.source.title,
          source_type: payload.source.sourceType,
          source_reference: payload.source.sourceReference ?? null,
          category: payload.source.category ?? null,
          tags: payload.source.tags ?? [],
          language: payload.source.language ?? 'pt-BR',
          status: payload.source.status ?? 'active',
        })
        .select('id')
        .single();
      if (error) throw error;
      sourceId = source.id;
    }

    const results: Array<{ title: string; skipped: boolean; chunks: number }> = [];

    for (const document of payload.documents) {
      const normalized = normalizeContent(document.text);
      const checksum = await sha256(`${document.title}::${normalized}`);

      const { data: existingDoc } = await admin
        .from('nutrition_knowledge_documents')
        .select('id')
        .eq('source_id', sourceId)
        .eq('checksum', checksum)
        .maybeSingle();

      if (existingDoc) {
        results.push({ title: document.title, skipped: true, chunks: 0 });
        continue;
      }

      const { data: newDocument, error: docError } = await admin
        .from('nutrition_knowledge_documents')
        .insert({
          source_id: sourceId,
          title: document.title,
          document_text: normalized,
          checksum,
          version: document.version ?? 'v1',
        })
        .select('id')
        .single();

      if (docError) throw docError;

      const chunks = chunkText(normalized, CHUNK_SIZE, CHUNK_OVERLAP);
      const embeddings = await embedMany(chunks);

      const rows = chunks.map((content, index) => ({
        document_id: newDocument.id,
        source_id: sourceId,
        chunk_index: index,
        content,
        category: document.category ?? payload.source.category ?? null,
        subcategory: document.subcategory ?? null,
        tags: document.tags ?? payload.source.tags ?? [],
        metadata: document.metadata ?? {},
        embedding: embeddings[index],
      }));

      const { error: chunkError } = await admin.from('nutrition_knowledge_chunks').insert(rows);
      if (chunkError) throw chunkError;

      results.push({ title: document.title, skipped: false, chunks: rows.length });
    }

    return new Response(JSON.stringify({ sourceId, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[ingest-nutrition-knowledge] error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
