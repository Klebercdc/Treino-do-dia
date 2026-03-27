import { createServerSupabaseClient } from '../../../../lib/supabase/server';

interface BodyPayload {
  conversationId: string;
  userMessage: string;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return Response.json({ error: 'Token ausente' }, { status: 401 });
    }

    const body = (await req.json()) as BodyPayload;
    if (!body?.userMessage || !body?.conversationId) {
      return Response.json({ error: 'conversationId e userMessage são obrigatórios' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient(token);
    const { data, error } = await supabase.functions.invoke('generate-nutrition-context', {
      body: {
        conversationId: body.conversationId,
        userMessage: body.userMessage,
      },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return Response.json({ error: message }, { status: 500 });
  }
}
