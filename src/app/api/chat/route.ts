import { NextResponse } from 'next/server';
import { requireBearerAuth } from '../_shared/requireBearerAuth';
import { getSupabaseConfig } from '../../../lib/utils/env.server';
import { checkRateLimit } from '../../../lib/utils/serverRateLimit';

export async function POST(req: Request) {
  try {
    const auth = await requireBearerAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = auth.accessToken;
    const rl = checkRateLimit(auth.user.id, { max: 20, windowMs: 60000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.message || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const supabase = getSupabaseConfig('server');

    const response = await fetch(`${supabase.url}/functions/v1/generate-nutrition-context`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabase.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage: body.message,
        conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
      }),
    });

    const payload = await response.json().catch(() => ({ error: 'Invalid response from AI service' }));
    if (!response.ok) {
      return NextResponse.json(
        { error: (payload as Record<string, unknown>)?.error ?? 'Chat execution failed' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
