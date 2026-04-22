import { NextRequest, NextResponse } from 'next/server';
import { requireBearerAuth } from '../../_shared/requireBearerAuth';
import { checkRateLimit } from '../../../../lib/utils/serverRateLimit';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']);
const MAX_BASE64_CHARS = 10 * 1024 * 1024 * 1.4; // ~10 MB decoded

function resolveOcrServiceUrl(): string {
  const explicit = String(process.env.EXAM_OCR_SERVICE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://kronia.app.br').trim();
  return `${appUrl.replace(/\/$/, '')}/api/exam_ocr`;
}

async function extractViaPdfOcr(base64: string, mimeType: string): Promise<string | null> {
  const buf = Buffer.from(base64, 'base64');
  const ext = mimeType.includes('pdf') ? '.pdf' : mimeType.includes('png') ? '.png' : '.jpg';
  const tmpPath = join(tmpdir(), `kronos_chat_${randomUUID()}${ext}`);
  try {
    await writeFile(tmpPath, buf);
    const ocrUrl = resolveOcrServiceUrl();
    const resp = await fetch(ocrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_path: tmpPath, mime_type: mimeType }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    return (data && typeof data.raw_text === 'string' && data.raw_text.trim()) ? data.raw_text : null;
  } catch {
    return null;
  } finally {
    unlink(tmpPath).catch(() => {});
  }
}

async function extractViaGroqVision(base64: string, mimeType: string): Promise<string | null> {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return null;

  const VISION_MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
  const prompt = 'Extraia todo o texto deste exame laboratorial. Liste cada resultado em uma linha: nome do exame, valor, unidade e valor de referência (se visível). Inclua a data de coleta se presente. Seja completo e literal.';

  for (const model of VISION_MODELS) {
    try {
      const body = JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        }],
      });
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body,
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) continue;
      const data = await resp.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) return text;
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req);
    if ('response' in auth) return auth.response;

    const rl = await checkRateLimit(auth.user.id, { max: 10, windowMs: 60000, category: 'chat_file' });
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Muitas requisições. Aguarde.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.fileData !== 'string' || !body.fileData.trim()) {
      return NextResponse.json({ ok: false, error: 'fileData é obrigatório.' }, { status: 400 });
    }

    const mimeType = String(body.mimeType || 'application/pdf').toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ ok: false, error: 'Formato não suportado. Use PDF, JPEG ou PNG.' }, { status: 400 });
    }
    if (body.fileData.length > MAX_BASE64_CHARS) {
      return NextResponse.json({ ok: false, error: 'Arquivo muito grande. Máximo 10 MB.' }, { status: 400 });
    }

    let extractedText: string | null = null;

    if (mimeType === 'application/pdf') {
      extractedText = await extractViaPdfOcr(body.fileData, mimeType);
    } else {
      // Images: try Groq vision first, fallback to OCR service
      extractedText = await extractViaGroqVision(body.fileData, mimeType);
      if (!extractedText) {
        extractedText = await extractViaPdfOcr(body.fileData, mimeType);
      }
    }

    if (!extractedText) {
      return NextResponse.json({ ok: false, error: 'Não foi possível extrair o texto do arquivo.' }, { status: 422 });
    }

    return NextResponse.json({ ok: true, text: extractedText.slice(0, 8000) });
  } catch (error) {
    console.error('[kronia/chat-file] erro:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'Erro ao processar arquivo.' }, { status: 500 });
  }
}
