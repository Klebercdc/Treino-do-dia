import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CheckResult, RuntimeContext } from './types';

export async function runAiChecks(runtime: RuntimeContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const service = createClient(runtime.checkContext.supabaseUrl, runtime.checkContext.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  results.push(await testGenerateNutritionContext(runtime, service));
  results.push(await validateAiContext(runtime));
  results.push(await validateContextLogs(runtime, service));

  return results;
}

async function testGenerateNutritionContext(runtime: RuntimeContext, service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const userId = runtime.state.testUserAId as string | undefined;
    const userToken = runtime.state.testUserAToken as string | undefined;
    if (!userId || !userToken) {
      return {
        step: '8. Teste da Edge Function generate-nutrition-context',
        status: 'WARNING',
        description: 'Usuário de teste não disponível; teste de edge function pulado.',
        suggestion: 'Garanta que o check de auth foi executado sem erro.',
        durationMs: Date.now() - startedAt,
      };
    }

    await service.from('profiles').upsert({
      id: userId,
      full_name: 'System Check User A',
      objective: 'emagrecimento',
      dietary_pattern: 'onivoro',
      allergies: [],
      intolerances: [],
    });

    await service.from('nutrition_goals').insert({
      user_id: userId,
      calories_target: 1800,
      protein_g: 130,
      carbs_g: 170,
      fat_g: 55,
      meal_strategy: 'refeições distribuídas ao longo do dia',
    });

    const { data: conversation, error: conversationError } = await service
      .from('ai_conversations')
      .insert({ user_id: userId, title: 'System Check Conversation' })
      .select('id')
      .single();
    if (conversationError || !conversation) throw conversationError ?? new Error('Falha ao criar conversa de teste.');

    runtime.state.aiConversationId = conversation.id;

    const anonAuthed = createClient(runtime.checkContext.supabaseUrl, runtime.checkContext.anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const startedCallAt = Date.now();
    const { data, error } = await anonAuthed.functions.invoke('generate-nutrition-context', {
      body: {
        conversationId: conversation.id,
        userMessage: 'quero melhorar minha dieta',
      },
    });
    const responseTimeMs = Date.now() - startedCallAt;

    if (error) throw new Error(error.message);

    runtime.state.aiResponse = data;
    runtime.state.aiResponseTimeMs = responseTimeMs;

    return {
      step: '8. Teste da Edge Function generate-nutrition-context',
      status: data?.answer ? 'OK' : 'WARNING',
      description: data?.answer
        ? 'Edge Function respondeu com sucesso e sem erro.'
        : 'Edge Function executou, porém sem campo answer esperado.',
      details: {
        responseTimeMs,
        hasAnswer: Boolean(data?.answer),
        contextSummary: data?.contextSummary ?? null,
      },
      suggestion: data?.answer ? undefined : 'Padronize retorno da função com campo answer.',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '8. Teste da Edge Function generate-nutrition-context',
      status: 'ERROR',
      description: 'Falha ao invocar edge function.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique deploy da função, variáveis AI_* e permissões de auth.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function validateAiContext(runtime: RuntimeContext): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const response = runtime.state.aiResponse as Record<string, unknown> | undefined;
    if (!response) {
      return {
        step: '9. Teste de contexto da IA',
        status: 'WARNING',
        description: 'Resposta da edge function indisponível; validação contextual não executada.',
        durationMs: Date.now() - startedAt,
      };
    }

    const answer = String(response.answer ?? '');
    const contextSummary = (response.contextSummary ?? {}) as Record<string, unknown>;

    const hasUserData = Boolean(contextSummary.hasProfile) || /perfil|meta|dieta|caloria/i.test(answer);
    const hasDbData = Boolean(contextSummary.hasGoals || contextSummary.hasActivePlan);
    const hasKnowledgeData = Number(contextSummary.semanticChunkCount ?? 0) > 0 || /recomend|estratég|prote/i.test(answer);

    const status = hasUserData && hasDbData && hasKnowledgeData ? 'OK' : 'WARNING';

    return {
      step: '9. Teste de contexto da IA',
      status,
      description:
        status === 'OK'
          ? 'Resposta sinaliza uso de dados pessoais + banco + repertório nutricional.'
          : 'Não foi possível comprovar todos os sinais de contexto na resposta.',
      details: {
        hasUserData,
        hasDbData,
        hasKnowledgeData,
        contextSummary,
      },
      suggestion:
        status === 'OK'
          ? undefined
          : 'Reforce prompt interno para explicitar quando usou perfil/metas/plano e chunks semânticos.',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '9. Teste de contexto da IA',
      status: 'ERROR',
      description: 'Erro ao validar conteúdo contextual da resposta.',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function validateContextLogs(runtime: RuntimeContext, service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const userId = runtime.state.testUserAId as string | undefined;
    const conversationId = runtime.state.aiConversationId as string | undefined;

    if (!userId || !conversationId) {
      return {
        step: '10. Logs e auditoria (ai_context_logs)',
        status: 'WARNING',
        description: 'Sem user/conversation de teste; validação de logs não executada.',
        durationMs: Date.now() - startedAt,
      };
    }

    const { data, error } = await service
      .from('ai_context_logs')
      .select('id,created_at,model_name,final_context')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return {
      step: '10. Logs e auditoria (ai_context_logs)',
      status: data ? 'OK' : 'WARNING',
      description: data ? 'Log de contexto da IA encontrado.' : 'Nenhum log encontrado para a conversa testada.',
      details: { latestLog: data ?? null },
      suggestion: data ? undefined : 'Verifique inserção em ai_context_logs na edge function.',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '10. Logs e auditoria (ai_context_logs)',
      status: 'ERROR',
      description: 'Falha ao validar logs de contexto da IA.',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}
