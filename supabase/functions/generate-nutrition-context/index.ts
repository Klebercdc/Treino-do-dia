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
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

  if (!response.ok) {
    throw new Error(`Groq error: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const chatKey = Deno.env.get('GROQ_API_KEY');
    const chatModel = Deno.env.get('AI_CHAT_MODEL') ?? 'llama-3.3-70b-versatile';

    console.log(`[AI] provider=groq model=${chatModel} chatKey=${maskSecret(chatKey)}`);

    if (!supabaseUrl || !supabaseAnon || !supabaseService) {
      return jsonResponse(500, { error: 'Variáveis de ambiente do Supabase ausentes.' });
    }
    if (!chatKey) {
      return jsonResponse(500, { error: 'GROQ_API_KEY não configurada.' });
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!token) return jsonResponse(401, { error: 'Unauthorized' });

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const adminClient = createClient(supabaseUrl, supabaseService, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse(401, { error: 'Autenticação falhou.' });

    const userId = authData.user.id;
    const body = await req.json();
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined;
    const userMessage = sanitizeInput(String(body.userMessage ?? ''));
    const intent = detectIntent(userMessage);

    // Gerenciar conversa
    let ensuredConversationId = conversationId;
    if (conversationId) {
      const { data: conversation, error: conversationError } = await userClient
        .from('ai_conversations')
        .select('id,user_id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (conversationError) {
        return jsonResponse(500, { error: `Validação da conversa falhou: ${conversationError.message}` });
      }
      if (!conversation) {
        return jsonResponse(403, { error: 'Conversa não pertence ao usuário atual.' });
      }
    } else {
      const { data: inserted, error: createError } = await adminClient
        .from('ai_conversations')
        .insert({ user_id: userId, title: userMessage.slice(0, 80) })
        .select('id')
        .single();

      if (createError || !inserted) {
        return jsonResponse(500, { error: `Não foi possível criar conversa: ${createError?.message}` });
      }
      ensuredConversationId = inserted.id;
    }

    // Buscar contexto do usuário em paralelo
    const [
      { data: profile, error: profileError },
      { data: goals, error: goalsError },
      { data: plan, error: planError },
    ] = await Promise.all([
      userClient.from('profiles').select('*').eq('id', userId).maybeSingle(),
      userClient
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      userClient
        .from('meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileError) return jsonResponse(500, { error: `Perfil: ${profileError.message}` });
    if (goalsError) return jsonResponse(500, { error: `Metas: ${goalsError.message}` });
    if (planError) return jsonResponse(500, { error: `Plano alimentar: ${planError.message}` });

    // Buscar dados dependentes do plano + logs em paralelo
    const [
      { data: planItems, error: planItemsError },
      { data: foodLogs, error: foodLogsError },
      { data: hydrationLogs, error: hydrationError },
      { data: bodyMetrics, error: metricsError },
      { data: supplements, error: supplementError },
      { data: recentMessages, error: recentMessagesError },
      { data: knowledgeChunks, error: chunksError },
    ] = await Promise.all([
      plan
        ? userClient
            .from('meal_plan_items')
            .select('*')
            .eq('meal_plan_id', plan.id)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      userClient.rpc('get_recent_food_logs', { p_user_id: userId, p_limit: 20 }),
      userClient.rpc('get_recent_hydration_logs', { p_user_id: userId, p_limit: 20 }),
      userClient.rpc('get_latest_body_metrics', { p_user_id: userId }),
      userClient.from('supplement_protocols').select('*').eq('user_id', userId).eq('active', true),
      userClient
        .from('ai_messages')
        .select('role,content,created_at')
        .eq('conversation_id', ensuredConversationId)
        .order('created_at', { ascending: false })
        .limit(12),
      userClient.rpc('search_nutrition_knowledge', {
        search_query: userMessage,
        match_count: 8,
        category_filter: null,
      }),
    ]);

    if (planItemsError) return jsonResponse(500, { error: `Itens do plano: ${planItemsError.message}` });
    if (foodLogsError) return jsonResponse(500, { error: `Logs de refeição: ${foodLogsError.message}` });
    if (hydrationError) return jsonResponse(500, { error: `Logs de hidratação: ${hydrationError.message}` });
    if (metricsError) return jsonResponse(500, { error: `Métricas corporais: ${metricsError.message}` });
    if (supplementError) return jsonResponse(500, { error: `Suplementos: ${supplementError.message}` });
    if (recentMessagesError) return jsonResponse(500, { error: `Histórico de mensagens: ${recentMessagesError.message}` });

    if (chunksError) {
      console.warn('[AI] Busca na base de conhecimento falhou:', chunksError.message);
    }

    const context = {
      intent,
      profile,
      goals,
      plan,
      planItems: planItems ?? [],
      logs: {
        foodLogs: foodLogs ?? [],
        hydrationLogs: hydrationLogs ?? [],
        bodyMetrics: bodyMetrics ?? [],
      },
      supplements: supplements ?? [],
      recentMessages: (recentMessages ?? []).reverse(),
      knowledgeChunks: knowledgeChunks ?? [],
    };

    const systemPrompt = buildSystemPrompt(context);
    const rawAnswer = await generateChatCompletion(chatKey, chatModel, systemPrompt, userMessage);
    const answer = validateAiResponse(rawAnswer, Boolean(profile || goals || (knowledgeChunks ?? []).length));

    // Persistir mensagens
    const { error: insertMessagesError } = await adminClient.from('ai_messages').insert([
      {
        conversation_id: ensuredConversationId,
        user_id: userId,
        role: 'user',
        content: userMessage,
        metadata: { intent, provider: 'groq' },
      },
      {
        conversation_id: ensuredConversationId,
        user_id: userId,
        role: 'assistant',
        content: answer,
        metadata: { intent, model: chatModel, provider: 'groq' },
      },
    ]);
    if (insertMessagesError) {
      return jsonResponse(500, { error: `Falha ao salvar mensagens: ${insertMessagesError.message}` });
    }

    // Log de contexto para auditoria
    const { error: contextLogError } = await adminClient.from('ai_context_logs').insert({
      user_id: userId,
      conversation_id: ensuredConversationId,
      query_text: userMessage,
      intent,
      retrieved_profile: profile,
      retrieved_goals: goals,
      retrieved_plan: { plan, planItems: planItems ?? [] },
      retrieved_recent_logs: {
        foodLogs: foodLogs ?? [],
        hydrationLogs: hydrationLogs ?? [],
        bodyMetrics: bodyMetrics ?? [],
        supplements: supplements ?? [],
      },
      retrieved_semantic_chunks: knowledgeChunks ?? [],
      final_context: context,
      model_name: chatModel,
      response_text: answer,
    });
    if (contextLogError) {
      return jsonResponse(500, { error: `Falha ao salvar log de contexto: ${contextLogError.message}` });
    }

    return jsonResponse(200, {
      message: answer,
      intent,
      conversationId: ensuredConversationId,
      contextSummary: `profile=${!!profile}; goals=${!!goals}; chunks=${(knowledgeChunks ?? []).length}`,
      metadata: {
        provider: 'groq',
        model: chatModel,
        chunkCount: (knowledgeChunks ?? []).length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno.';
    return jsonResponse(500, { error: message });
  }
});
