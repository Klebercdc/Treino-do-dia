import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { getSupabaseConfig } from '../../../lib/utils/env';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const db = createServerSupabaseClient(accessToken);
    const { data: userData, error: authError } = await db.auth.getUser();

    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
