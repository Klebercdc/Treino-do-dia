import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RetrievalIntent =
  | 'current_diet'
  | 'progress_analysis'
  | 'supplementation'
  | 'general_nutrition_question'
  | 'meal_adjustment'
  | 'hydration'
  | 'body_composition'
  | 'fallback';

type AiProvider = 'groq' | 'openai' | 'generic';

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

function maskSecret(value?: string | null): string {
  if (!value) return 'missing';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getAiProvider(): AiProvider {
  const explicit = Deno.env.get('AI_PROVIDER')?.toLowerCase();
  if (explicit === 'groq') return 'groq';
  if (explicit === 'openai') return 'openai';
  if (explicit === 'generic') return 'generic';

  if (Deno.env.get('GROQ_API_KEY')) return 'groq';
  return 'generic';
}

function getAiChatKey(provider: AiProvider): string | undefined {
  if (provider === 'groq') return Deno.env.get('GROQ_API_KEY') ?? undefined;
  return Deno.env.get('GROQ_API_KEY') ?? undefined;
}

function getAiEmbeddingKey(): string | undefined {
  return Deno.env.get('GROQ_API_KEY') ?? undefined;
}

function sanitizeInput(input: string): string {
  const text = input.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Mensagem vazia.');
  if (text.length > 4000) throw new Error('Mensagem excede o limite permitido.');
  return text;
}

function detectIntent(message: string): RetrievalIntent {
  const map: Array<[RetrievalIntent, RegExp]> = [
    ['current_diet', /(plano|dieta|card[aá]pio|refeiç)/i],
    ['progress_analysis', /(progresso|evolu|resultado|m[eé]trica)/i],
    ['supplementation', /(suplement|creatina|whey|vitamina|mineral)/i],
    ['meal_adjustment', /(ajuste|substitu|trocar refeiç)/i],
    ['hydration', /(hidrata|[áa]gua|water)/i],
    ['body_composition', /(composiç|gordura|massa magra|circunfer|peso)/i],
    ['general_nutrition_question', /(nutri|macro|micro|caloria)/i],
  ];

  for (const [intent, re] of map) if (re.test(message)) return intent;
  return 'fallback';
}

async function embedQuestion(apiKey: string, model: string, text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) throw new Error(`Embedding provider error: ${response.status} ${await response.text()}`);
  const json = await response.json();
  const embedding = json.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error('Embedding inválido retornado pelo provider.');
  }
  return embedding;
}

function buildSystemPrompt(context: Record<string, unknown>): string {
  return [
    'Você é uma IA de nutrição clínica e esportiva.',
    'Nunca invente dados e use apenas as informações do contexto.',
    'Separe claramente dados pessoais de conhecimento geral.',
    'Se faltar dado do usuário, declare explicitamente a ausência.',
    'Responda de forma objetiva, segura e personalizável para app de nutrição.',
    `CONTEXTO_JSON: ${JSON.stringify(context)}`,
  ].join('\n\n');
}

function validateAiResponse(content: string, hasContext: boolean): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return 'Não consegui gerar uma resposta segura agora. Tente novamente em alguns instantes.';
  }
  if (hasContext && !/plano|meta|perfil|dados|hidrata|registro|contexto|suplement/i.test(trimmed)) {
    return 'Consigo responder com segurança, mas preciso reforçar o uso do seu contexto. Tente reformular sua pergunta.';
  }
  return trimmed;
}

async function generateChatCompletion(
  provider: AiProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const endpoint = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) throw new Error(`${provider.toUpperCase()} provider error: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const provider = getAiProvider();
    const chatKey = getAiChatKey(provider);
    const embeddingKey = getAiEmbeddingKey();
    const embeddingModel = Deno.env.get('AI_EMBEDDING_MODEL') ?? '';
    const chatModel = Deno.env.get('AI_CHAT_MODEL') ?? (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4.1-mini');

    console.log(
      `[AI] provider=${provider} chatKey=${maskSecret(chatKey)} embeddingKey=${maskSecret(embeddingKey)} embeddingModel=${embeddingModel || 'missing'}`,
    );

    if (!url || !anon || !service) return jsonResponse(500, { error: 'Supabase environment variables are missing.' });
    if (!chatKey) {
      return jsonResponse(500, {
        error: 'Nenhuma chave de IA encontrada. Configure GROQ_API_KEY.',
      });
    }
    if (!chatModel) {
      return jsonResponse(500, { error: `Provider ${provider} detectado, mas modelo de chat está ausente.` });
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return jsonResponse(401, { error: 'Unauthorized' });

    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const adminClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse(401, { error: 'Authentication failed.' });

    const userId = authData.user.id;
    const body = await req.json();
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined;
    const userMessage = sanitizeInput(String(body.userMessage ?? ''));
    const intent = detectIntent(userMessage);

    let ensuredConversationId = conversationId;
    if (conversationId) {
      const { data: conversation, error: conversationError } = await userClient
        .from('ai_conversations')
        .select('id,user_id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (conversationError) return jsonResponse(500, { error: `Conversation validation failed: ${conversationError.message}` });
      if (!conversation) return jsonResponse(403, { error: 'Conversation does not belong to current user.' });
    } else {
      const { data: insertedConversation, error: createConversationError } = await adminClient
        .from('ai_conversations')
        .insert({ user_id: userId, title: userMessage.slice(0, 80) })
        .select('id')
        .single();

      if (createConversationError || !insertedConversation) {
        return jsonResponse(500, { error: `Unable to create conversation: ${createConversationError?.message}` });
      }
      ensuredConversationId = insertedConversation.id;
    }

    const { data: profile, error: profileError } = await userClient.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (profileError) return jsonResponse(500, { error: `Profile query failed: ${profileError.message}` });

    const { data: goals, error: goalsError } = await userClient
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (goalsError) return jsonResponse(500, { error: `Goals query failed: ${goalsError.message}` });

    const { data: plan, error: planError } = await userClient
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planError) return jsonResponse(500, { error: `Meal plan query failed: ${planError.message}` });

    const { data: planItems, error: planItemsError } = plan
      ? await userClient.from('meal_plan_items').select('*').eq('meal_plan_id', plan.id).order('sort_order', { ascending: true })
      : { data: [], error: null };
    if (planItemsError) return jsonResponse(500, { error: `Meal plan items query failed: ${planItemsError.message}` });

    const { data: foodLogs, error: foodLogsError } = await userClient.rpc('get_recent_food_logs', { p_user_id: userId, p_limit: 20 });
    if (foodLogsError) return jsonResponse(500, { error: `Food logs query failed: ${foodLogsError.message}` });

    const { data: hydrationLogs, error: hydrationError } = await userClient.rpc('get_recent_hydration_logs', { p_user_id: userId, p_limit: 20 });
    if (hydrationError) return jsonResponse(500, { error: `Hydration logs query failed: ${hydrationError.message}` });

    const { data: bodyMetrics, error: metricsError } = await userClient.rpc('get_latest_body_metrics', { p_user_id: userId });
    if (metricsError) return jsonResponse(500, { error: `Body metrics query failed: ${metricsError.message}` });

    const { data: supplements, error: supplementError } = await userClient
      .from('supplement_protocols')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);
    if (supplementError) return jsonResponse(500, { error: `Supplements query failed: ${supplementError.message}` });

    const { data: recentMessages, error: recentMessagesError } = await userClient
      .from('ai_messages')
      .select('role,content,created_at')
      .eq('conversation_id', ensuredConversationId)
      .order('created_at', { ascending: false })
      .limit(12);
    if (recentMessagesError) return jsonResponse(500, { error: `Messages query failed: ${recentMessagesError.message}` });

    let chunks: unknown[] = [];
    let embeddingsSkipped = false;

    if (embeddingKey && embeddingModel) {
      const queryEmbedding = await embedQuestion(embeddingKey, embeddingModel, userMessage);
      const { data: semanticChunks, error: chunkError } = await userClient.rpc('match_nutrition_knowledge', {
        query_embedding: queryEmbedding,
        match_count: 8,
        category_filter: null,
        tags_filter: null,
      });
      if (chunkError) return jsonResponse(500, { error: `Semantic retrieval failed: ${chunkError.message}` });
      chunks = semanticChunks ?? [];
    } else {
      embeddingsSkipped = true;
      console.log('[AI] Embeddings skipped: embedding key/model missing.');
    }

    const context = {
      intent,
      profile,
      goals,
      plan,
      planItems: planItems ?? [],
      logs: { foodLogs: foodLogs ?? [], hydrationLogs: hydrationLogs ?? [], bodyMetrics: bodyMetrics ?? [] },
      supplements: supplements ?? [],
      recentMessages: (recentMessages ?? []).reverse(),
      chunks,
      embeddingsSkipped,
    };

    const systemPrompt = buildSystemPrompt(context);
    const rawAnswer = await generateChatCompletion(provider, chatKey, chatModel, systemPrompt, userMessage);
    const answer = validateAiResponse(rawAnswer, Boolean(profile || goals || chunks.length));

    const { error: insertMessagesError } = await adminClient.from('ai_messages').insert([
      { conversation_id: ensuredConversationId, user_id: userId, role: 'user', content: userMessage, metadata: { intent, provider } },
      { conversation_id: ensuredConversationId, user_id: userId, role: 'assistant', content: answer, metadata: { intent, model: chatModel, provider } },
    ]);
    if (insertMessagesError) return jsonResponse(500, { error: `Message persistence failed: ${insertMessagesError.message}` });

    const { error: contextLogError } = await adminClient.from('ai_context_logs').insert({
      user_id: userId,
      conversation_id: ensuredConversationId,
      query_text: userMessage,
      intent,
      retrieved_profile: profile,
      retrieved_goals: goals,
      retrieved_plan: { plan, planItems: planItems ?? [] },
      retrieved_recent_logs: { foodLogs: foodLogs ?? [], hydrationLogs: hydrationLogs ?? [], bodyMetrics: bodyMetrics ?? [], supplements: supplements ?? [] },
      retrieved_semantic_chunks: chunks,
      final_context: context,
      model_name: chatModel,
      response_text: answer,
    });
    if (contextLogError) return jsonResponse(500, { error: `Context log persistence failed: ${contextLogError.message}` });

    return jsonResponse(200, {
      message: answer,
      intent,
      conversationId: ensuredConversationId,
      contextSummary: `profile=${!!profile}; goals=${!!goals}; chunks=${chunks.length}; embeddingsSkipped=${embeddingsSkipped}`,
      metadata: {
        provider,
        model: chatModel,
        embeddingModel: embeddingModel || null,
        chunkCount: chunks.length,
        embeddingsSkipped,
      },
    });
  } catch (error) {
    return jsonResponse(500, { error: (error as Error).message });
  }
});
