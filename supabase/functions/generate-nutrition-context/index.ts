import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;

type IntentType = 'diet_current' | 'progress' | 'conceptual' | 'supplementation' | 'general';

interface ChatPayload {
  conversationId: string;
  userMessage: string;
  category?: string;
  tags?: string[];
  sourceType?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AI_API_KEY = Deno.env.get('AI_API_KEY') ?? '';
const AI_CHAT_MODEL = Deno.env.get('AI_CHAT_MODEL') ?? 'gpt-4.1-mini';
const AI_EMBEDDING_MODEL = Deno.env.get('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
const AI_API_URL = Deno.env.get('AI_API_URL') ?? 'https://api.openai.com/v1';
const MAX_MESSAGE_LENGTH = Number(Deno.env.get('MAX_USER_MESSAGE_LENGTH') ?? '1500');
const MAX_CHUNKS = Number(Deno.env.get('MAX_SEMANTIC_CHUNKS') ?? '8');
const MAX_HISTORY = Number(Deno.env.get('MAX_CONVERSATION_HISTORY') ?? '8');

const INTERNAL_SYSTEM_PROMPT = `Você é uma IA nutricional contextual para app clínico/esportivo.
Antes de responder, considere perfil, metas, plano alimentar, registros recentes, suplementação e repertório vetorial.
Nunca invente dados. Quando faltar informação, diga explicitamente.
Diferencie recomendação geral de dado pessoal.
Responda com linguagem profissional, clara, objetiva e útil para app mobile.`;

function requireEnv(): void {
  const required = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    AI_API_KEY,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}

function sanitizeUserInput(text: string): string {
  const normalized = text
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) throw new Error('Mensagem vazia após sanitização.');
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Mensagem excede limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
  }
  return normalized;
}

function detectIntent(message: string): IntentType {
  const text = message.toLowerCase();
  if (/(plano|dieta|refeiç|cardápio)/.test(text)) return 'diet_current';
  if (/(progresso|evoluç|peso|medidas|hidrata)/.test(text)) return 'progress';
  if (/(suplement|creatina|whey|vitamina|mineral)/.test(text)) return 'supplementation';
  if (/(o que é|como funciona|conceito|explica)/.test(text)) return 'conceptual';
  return 'general';
}

async function generateEmbedding(input: string): Promise<number[]> {
  const response = await fetch(`${AI_API_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: AI_EMBEDDING_MODEL, input }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding provider error ${response.status}: ${text}`);
  }

  const payload = await response.json();
  return payload.data?.[0]?.embedding ?? [];
}

async function generateCompletion(systemPrompt: string, userMessage: string, history: Array<{ role: string; content: string }>): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${AI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: AI_CHAT_MODEL, temperature: 0.2, messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat provider error ${response.status}: ${text}`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content ?? 'Não consegui gerar uma resposta agora.';
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    requireEnv();

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token ausente.' }), { status: 401 });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401 });
    }

    const userId = authData.user.id;
    const payload = (await req.json()) as ChatPayload;
    if (!payload?.conversationId || !payload?.userMessage) {
      return new Response(JSON.stringify({ error: 'conversationId e userMessage são obrigatórios' }), { status: 400 });
    }

    const userMessage = sanitizeUserInput(payload.userMessage);
    const intent = detectIntent(userMessage);

    const { data: conversation, error: conversationError } = await userClient
      .from('ai_conversations')
      .select('id, user_id')
      .eq('id', payload.conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada para o usuário.' }), { status: 404 });
    }

    const [
      profileResult,
      goalsResult,
      activePlanResult,
      foodLogsResult,
      hydrationResult,
      bodyMetricsResult,
      supplementsResult,
      historyResult,
    ] = await Promise.all([
      userClient.from('profiles').select('*').eq('id', userId).maybeSingle(),
      userClient.from('nutrition_goals').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      userClient.rpc('get_active_meal_plan', { p_user_id: userId }).maybeSingle(),
      userClient.from('user_food_logs').select('*').eq('user_id', userId).order('consumed_at', { ascending: false }).limit(8),
      userClient.from('hydration_logs').select('*').eq('user_id', userId).order('consumed_at', { ascending: false }).limit(8),
      userClient.rpc('get_latest_body_metrics', { p_user_id: userId, p_limit: 5 }),
      userClient.from('supplement_protocols').select('*').eq('user_id', userId).eq('active', true),
      userClient.from('ai_messages').select('role, content, created_at').eq('user_id', userId).eq('conversation_id', payload.conversationId).order('created_at', { ascending: false }).limit(MAX_HISTORY),
    ]);

    for (const result of [profileResult, goalsResult, activePlanResult, foodLogsResult, hydrationResult, bodyMetricsResult, supplementsResult, historyResult]) {
      if (result.error) throw result.error;
    }

    const activePlan = activePlanResult.data;
    let planItems: Json[] = [];
    if (activePlan?.id) {
      const { data: items, error } = await userClient.from('meal_plan_items').select('*').eq('meal_plan_id', activePlan.id).order('sort_order', { ascending: true });
      if (error) throw error;
      planItems = (items ?? []) as Json[];
    }

    const embedding = await generateEmbedding(userMessage);
    if (!embedding.length) throw new Error('Embedding vazio retornado pelo provider.');

    const profile = profileResult.data as Json | null;
    const allergies = Array.isArray(profile?.allergies) ? profile?.allergies as string[] : [];
    const intolerances = Array.isArray(profile?.intolerances) ? profile?.intolerances as string[] : [];

    const { data: semanticChunks, error: semanticError } = await userClient.rpc('match_nutrition_knowledge', {
      query_embedding: embedding,
      match_count: Math.max(1, Math.min(MAX_CHUNKS, 12)),
      category_filter: payload.category ?? null,
      tags_filter: payload.tags?.length ? payload.tags : null,
      source_type_filter: payload.sourceType ?? null,
      objective_filter: String(profile?.objective ?? '' || null),
      dietary_pattern_filter: String(profile?.dietary_pattern ?? '' || null),
      allergies_filter: allergies.length ? allergies : null,
      intolerances_filter: intolerances.length ? intolerances : null,
    });

    if (semanticError) throw semanticError;

    const history = (historyResult.data ?? []).reverse().map((row) => ({ role: row.role, content: row.content }));

    const structuredContext = {
      profile: profileResult.data,
      goals: goalsResult.data,
      activePlan: { plan: activePlanResult.data, items: planItems },
      recentMeals: foodLogsResult.data ?? [],
      hydration: hydrationResult.data ?? [],
      bodyMetrics: bodyMetricsResult.data ?? [],
      supplements: supplementsResult.data ?? [],
      conversationHistory: history,
    };

    const contextSummary = {
      intent,
      hasProfile: Boolean(structuredContext.profile),
      hasGoals: Boolean(structuredContext.goals),
      hasActivePlan: Boolean(structuredContext.activePlan.plan),
      semanticChunkCount: semanticChunks?.length ?? 0,
    };

    const systemPrompt = [
      INTERNAL_SYSTEM_PROMPT,
      `Intenção: ${intent}`,
      `Resumo: ${JSON.stringify(contextSummary)}`,
      `Contexto estruturado: ${JSON.stringify(structuredContext)}`,
      `Repertório semântico: ${JSON.stringify(semanticChunks ?? [])}`,
    ].join('\n\n');

    const answer = await generateCompletion(systemPrompt, userMessage, history);

    const messageRows = [
      {
        conversation_id: payload.conversationId,
        user_id: userId,
        role: 'user',
        content: userMessage,
        metadata: { intent },
      },
      {
        conversation_id: payload.conversationId,
        user_id: userId,
        role: 'assistant',
        content: answer,
        metadata: { model: AI_CHAT_MODEL, contextSummary },
      },
    ];

    const { error: msgError } = await adminClient.from('ai_messages').insert(messageRows);
    if (msgError) throw msgError;

    const { error: logError } = await adminClient.from('ai_context_logs').insert({
      user_id: userId,
      conversation_id: payload.conversationId,
      query_text: userMessage,
      retrieved_profile: structuredContext.profile,
      retrieved_goals: structuredContext.goals,
      retrieved_plan: structuredContext.activePlan,
      retrieved_semantic_chunks: semanticChunks,
      final_context: {
        intent,
        contextSummary,
        model: AI_CHAT_MODEL,
      },
      model_name: AI_CHAT_MODEL,
    });
    if (logError) throw logError;

    await adminClient.from('ai_audit_logs').insert({
      user_id: userId,
      event_type: 'generate_nutrition_context',
      status: 'success',
      details: { intent, conversationId: payload.conversationId, semanticChunks: semanticChunks?.length ?? 0 },
    });

    return new Response(
      JSON.stringify({
        answer,
        contextSummary,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[generate-nutrition-context] error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
