import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest, ChatResponse } from '../../../../lib/ai/types';
import { requireBearerAuth } from '../../_shared/requireBearerAuth';
import { getAIConfig, getSupabaseConfig } from '../../../../lib/utils/env.server';
import { checkRateLimit } from '../../../../lib/utils/serverRateLimit';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth.ok) return auth.response;

    const accessToken = auth.accessToken;
    const rl = await checkRateLimit(auth.user.id, { max: 20, windowMs: 60000, category: 'chat_light' });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests', retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
    }

    const body = (await req.json()) as ChatRequest;
    if (!body?.userMessage || typeof body.userMessage !== 'string') {
      return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
    }

    const supabase = getSupabaseConfig('server');
    const ai = getAIConfig();

    const response = await fetch(`${supabase.url}/functions/v1/generate-nutrition-context`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabase.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return NextResponse.json({ error: payload?.error ?? 'Chat execution failed', provider: ai.provider }, { status: response.status });
    }

    return NextResponse.json(payload as ChatResponse, { status: 200 });
  } catch (error) {
    let provider: string | undefined;
    try { provider = getAIConfig().provider; } catch { /* env não configurado */ }
    return NextResponse.json({ error: (error as Error).message, provider }, { status: 500 });
  }
}
