import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CheckContext, CheckResult, RuntimeContext } from './types';

const REQUIRED_TABLES: Record<string, string[]> = {
  profiles: ['id', 'full_name', 'objective', 'created_at'],
  nutrition_goals: ['id', 'user_id', 'calories_target', 'updated_at'],
  meal_plans: ['id', 'user_id', 'title', 'status'],
  meal_plan_items: ['id', 'meal_plan_id', 'meal_name', 'food_name'],
  user_food_logs: ['id', 'user_id', 'consumed_at', 'food_name'],
  hydration_logs: ['id', 'user_id', 'consumed_at', 'water_ml'],
  body_metrics: ['id', 'user_id', 'measured_at'],
  supplement_protocols: ['id', 'user_id', 'supplement_name', 'active'],
  ai_conversations: ['id', 'user_id', 'title'],
  ai_messages: ['id', 'conversation_id', 'user_id', 'role', 'content'],
  nutrition_knowledge_chunks: ['id', 'document_id', 'source_id', 'embedding', 'content'],
};

function newClients(ctx: CheckContext): { service: SupabaseClient; anon: SupabaseClient } {
  return {
    service: createClient(ctx.supabaseUrl, ctx.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    anon: createClient(ctx.supabaseUrl, ctx.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

export async function runDbChecks(runtime: RuntimeContext): Promise<CheckResult[]> {
  const { checkContext } = runtime;
  const { service, anon } = newClients(checkContext);
  const results: CheckResult[] = [];

  results.push(await checkConnection(service));
  results.push(await checkAuthFlow(anon, service, runtime));
  results.push(await checkTablesAndColumns(service));
  results.push(await checkIndexes(service));

  return results;
}

async function checkConnection(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const { error } = await service.from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw error;

    return {
      step: '2. Conexão com Supabase',
      status: 'OK',
      description: 'Conexão com banco OK e query simples executada (head select).',
      details: { query: 'SELECT id FROM profiles LIMIT 0 (head request)' },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '2. Conexão com Supabase',
      status: 'ERROR',
      description: 'Falha de conexão com Supabase.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Revise SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY e conectividade de rede.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function checkAuthFlow(anon: SupabaseClient, service: SupabaseClient, runtime: RuntimeContext): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const email = `system.check.${Date.now()}@example.com`;
    const password = runtime.checkContext.testUserPassword;

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { source: 'system_check' },
    });
    if (createError || !created.user) throw createError ?? new Error('Não foi possível criar usuário de teste.');

    const userId = created.user.id;
    runtime.state.testUserAId = userId;

    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) throw signInError ?? new Error('Falha ao autenticar usuário de teste.');

    runtime.state.testUserAToken = signInData.session.access_token;
    runtime.state.testUserAEmail = email;

    const { data: userData, error: userError } = await anon.auth.getUser(signInData.session.access_token);
    if (userError || !userData.user) throw userError ?? new Error('Não foi possível validar sessão autenticada.');

    const { error: profileError } = await service.from('profiles').upsert({ id: userId, full_name: 'System Check User A' });
    if (profileError) throw profileError;

    return {
      step: '2. Conexão com Supabase (auth usuário)',
      status: 'OK',
      description: 'Autenticação com usuário logado validada com sucesso.',
      details: { userId },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '2. Conexão com Supabase (auth usuário)',
      status: 'ERROR',
      description: 'Falha ao validar autenticação de usuário.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique se o projeto permite sign-in com email/senha e se o ANON key está correto.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function checkTablesAndColumns(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const { data, error } = await service
      .from('information_schema.columns')
      .select('table_name,column_name,data_type,udt_name')
      .eq('table_schema', 'public')
      .in('table_name', Object.keys(REQUIRED_TABLES));

    if (error) throw error;

    const byTable = new Map<string, Set<string>>();
    for (const row of data ?? []) {
      const table = row.table_name as string;
      const col = row.column_name as string;
      if (!byTable.has(table)) byTable.set(table, new Set());
      byTable.get(table)?.add(col);
    }

    const missingTables: string[] = [];
    const missingColumns: Record<string, string[]> = {};

    for (const [table, requiredCols] of Object.entries(REQUIRED_TABLES)) {
      const cols = byTable.get(table);
      if (!cols) {
        missingTables.push(table);
        continue;
      }
      const missing = requiredCols.filter((column) => !cols.has(column));
      if (missing.length) missingColumns[table] = missing;
    }

    const hasIssues = missingTables.length || Object.keys(missingColumns).length;

    return {
      step: '3. Verificação de tabelas e colunas',
      status: hasIssues ? 'ERROR' : 'OK',
      description: hasIssues ? 'Foram encontradas ausências no schema esperado.' : 'Tabelas e colunas principais estão presentes.',
      details: {
        checkedTables: Object.keys(REQUIRED_TABLES),
        missingTables,
        missingColumns,
      },
      suggestion: hasIssues ? 'Execute novamente as migrations (ex.: supabase db push).' : undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '3. Verificação de tabelas e colunas',
      status: 'ERROR',
      description: 'Falha ao consultar information_schema.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Valide permissões da service role e existência de schema public.',
      durationMs: Date.now() - startedAt,
    };
  }
}

async function checkIndexes(service: SupabaseClient): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const expected = [
      'idx_nutrition_goals_user_id',
      'idx_meal_plans_user_id',
      'idx_user_food_logs_user_id',
      'idx_hydration_logs_user_id',
      'idx_body_metrics_user_id',
      'idx_supplement_protocols_user_id',
      'idx_nkc_embedding_ivfflat',
    ];

    const { data, error } = await service
      .from('pg_indexes')
      .select('indexname,tablename')
      .eq('schemaname', 'public')
      .in('indexname', expected);

    if (error) throw error;
    const found = new Set((data ?? []).map((row) => row.indexname as string));
    const missing = expected.filter((name) => !found.has(name));

    return {
      step: '3. Verificação de índices',
      status: missing.length ? 'WARNING' : 'OK',
      description: missing.length ? 'Alguns índices esperados não foram encontrados.' : 'Índices principais validados.',
      details: { expected, missing },
      suggestion: missing.length ? 'Reaplique a migration 018 para criar índices ausentes.' : undefined,
      suggestedSql: missing.length
        ? `-- exemplo\nCREATE INDEX IF NOT EXISTS ${missing[0]} ON public.<tabela>(<coluna>);`
        : undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      step: '3. Verificação de índices',
      status: 'ERROR',
      description: 'Falha ao verificar índices em pg_indexes.',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Verifique permissões de leitura em pg_catalog para service role.',
      durationMs: Date.now() - startedAt,
    };
  }
}
