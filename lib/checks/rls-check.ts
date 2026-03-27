import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CheckResult, RuntimeContext } from './types';

const SENSITIVE_TABLES = [
  'profiles',
  'nutrition_goals',
  'meal_plans',
  'meal_plan_items',
  'user_food_logs',
  'hydration_logs',
  'body_metrics',
  'supplement_protocols',
  'ai_conversations',
  'ai_messages',
  'ai_context_logs',
  'nutrition_knowledge_chunks',
];

export async function runRlsChecks(runtime: RuntimeContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const service = createClient(runtime.checkContext.supabaseUrl, runtime.checkContext.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  results.push(await checkRlsEnabled(service));
  results.push(await checkPoliciesExist(service));
  results.push(await simulateCrossUserIsolation(runtime, service));
  results.push(await runCrudRlsTest(runtime, service));

  return results;
}

async function checkRlsEnabled(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const { data, error } = await service
      .from('pg_tables')
      .select('tablename,rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', SENSITIVE_TABLES);

    if (error) throw error;
    const disabled = (data ?? []).filter((row) => !row.rowsecurity).map((row) => row.tablename as string);

    return {
      step: '4. Verificação de RLS (enabled)',
      status: disabled.length ? 'ERROR' : 'OK',
      description: disabled.length ? 'Existem tabelas sensíveis sem RLS ativo.' : 'RLS está ativo nas tabelas sensíveis verificadas.',
      details: { disabled },
      suggestion: disabled.length ? 'Ative RLS: ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;' : undefined,
      suggestedSql: disabled.length ? `ALTER TABLE public.${disabled[0]} ENABLE ROW LEVEL SECURITY;` : undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '4. Verificação de RLS (enabled)',
      status: 'ERROR',
      description: 'Falha ao verificar rowsecurity em pg_tables.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique se a service role tem acesso de leitura em pg_tables.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function checkPoliciesExist(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const { data, error } = await service
      .from('pg_policies')
      .select('tablename,policyname')
      .eq('schemaname', 'public')
      .in('tablename', SENSITIVE_TABLES);

    if (error) throw error;

    const policyCount = new Map<string, number>();
    for (const row of data ?? []) {
      const table = row.tablename as string;
      policyCount.set(table, (policyCount.get(table) ?? 0) + 1);
    }

    const noPolicy = SENSITIVE_TABLES.filter((table) => !policyCount.has(table));

    return {
      step: '4. Verificação de RLS (policies)',
      status: noPolicy.length ? 'ERROR' : 'OK',
      description: noPolicy.length ? 'Há tabelas sem políticas RLS.' : 'Políticas RLS encontradas para tabelas sensíveis.',
      details: { noPolicy, policyCount: Object.fromEntries(policyCount) },
      suggestion: noPolicy.length ? 'Crie políticas FOR SELECT/INSERT/UPDATE/DELETE conforme regras de owner.' : undefined,
      suggestedSql: noPolicy.length
        ? `CREATE POLICY "${noPolicy[0]}_own_all" ON public.${noPolicy[0]} FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
        : undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '4. Verificação de RLS (policies)',
      status: 'ERROR',
      description: 'Falha ao consultar pg_policies.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique acesso em pg_catalog para service role.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function simulateCrossUserIsolation(runtime: RuntimeContext, service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const userAId = runtime.state.testUserAId as string | undefined;
    const userAToken = runtime.state.testUserAToken as string | undefined;
    if (!userAId || !userAToken) {
      return {
        step: '4. Simulação A/B de isolamento RLS',
        status: 'WARNING',
        description: 'Sem usuário A autenticado; simulação de isolamento não executada.',
        suggestion: 'Garanta que o check de autenticação de usuário foi concluído com sucesso.',
        durationMs: Date.now() - startedAt,
      };
    }

    const emailB = `system.check.b.${Date.now()}@example.com`;
    const password = runtime.checkContext.testUserPassword;
    const { data: userBData, error: userBError } = await service.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
      user_metadata: { source: 'system_check' },
    });
    if (userBError || !userBData.user) throw userBError ?? new Error('Falha ao criar usuário B.');

    const userBId = userBData.user.id;
    runtime.state.testUserBId = userBId;

    await service.from('profiles').upsert({ id: userBId, full_name: 'System Check User B' });
    const { error: insertErr } = await service.from('nutrition_goals').insert({ user_id: userBId, calories_target: 2222 });
    if (insertErr) throw insertErr;

    const userAClient = createClient(runtime.checkContext.supabaseUrl, runtime.checkContext.anonKey, {
      global: { headers: { Authorization: `Bearer ${userAToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: visibleToA, error: readErr } = await userAClient
      .from('nutrition_goals')
      .select('id,user_id,calories_target')
      .eq('user_id', userBId);
    if (readErr) throw readErr;

    const isolated = (visibleToA ?? []).length === 0;

    return {
      step: '4. Simulação A/B de isolamento RLS',
      status: isolated ? 'OK' : 'ERROR',
      description: isolated
        ? 'Usuário A não conseguiu acessar dados do usuário B (RLS OK).'
        : 'Falha crítica: usuário A teve acesso a dados de usuário B.',
      details: { visibleRowsToUserA: (visibleToA ?? []).length, userBId },
      suggestion: isolated ? undefined : 'Revisar políticas USING/WITH CHECK por user_id imediatamente.',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '4. Simulação A/B de isolamento RLS',
      status: 'ERROR',
      description: 'Erro ao simular isolamento entre usuários.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Valide políticas de nutrition_goals e fluxo de autenticação com ANON + JWT.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function runCrudRlsTest(runtime: RuntimeContext, service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const userAId = runtime.state.testUserAId as string | undefined;
    const userAToken = runtime.state.testUserAToken as string | undefined;
    if (!userAId || !userAToken) {
      return {
        step: '5. Teste CRUD com RLS',
        status: 'WARNING',
        description: 'Sem usuário autenticado disponível; CRUD com RLS foi pulado.',
        durationMs: Date.now() - startedAt,
      };
    }

    const userAClient = createClient(runtime.checkContext.supabaseUrl, runtime.checkContext.anonKey, {
      global: { headers: { Authorization: `Bearer ${userAToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const insertPayload = { user_id: userAId, calories_target: 1999, meal_strategy: 'system-check' };
    const { data: inserted, error: insertError } = await userAClient
      .from('nutrition_goals')
      .insert(insertPayload)
      .select('id,user_id,calories_target')
      .single();
    if (insertError || !inserted) throw insertError ?? new Error('INSERT falhou.');

    const { data: readData, error: readError } = await userAClient
      .from('nutrition_goals')
      .select('id,calories_target')
      .eq('id', inserted.id)
      .single();
    if (readError || !readData) throw readError ?? new Error('READ falhou.');

    const { data: updated, error: updateError } = await userAClient
      .from('nutrition_goals')
      .update({ calories_target: 1888 })
      .eq('id', inserted.id)
      .select('id,calories_target')
      .single();
    if (updateError || !updated) throw updateError ?? new Error('UPDATE falhou.');

    const { error: deleteError } = await userAClient.from('nutrition_goals').delete().eq('id', inserted.id);
    if (deleteError) throw deleteError;

    return {
      step: '5. Teste CRUD com RLS',
      status: 'OK',
      description: 'INSERT/READ/UPDATE/DELETE executados com sucesso sob RLS do próprio usuário.',
      details: { insertedId: inserted.id, before: readData.calories_target, after: updated.calories_target },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '5. Teste CRUD com RLS',
      status: 'ERROR',
      description: 'Falha em operação CRUD sob RLS.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique policies FOR ALL em nutrition_goals com auth.uid() = user_id.',
      suggestedSql: 'CREATE POLICY "nutrition_goals_own_all" ON public.nutrition_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      durationMs: Date.now() - startedAt,
    };
  }
}
