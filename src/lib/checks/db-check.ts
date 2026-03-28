import { createClient } from '@supabase/supabase-js';
import type { CheckContext, CheckResult } from './types';

const REQUIRED_TABLES = [
  'profiles',
  'nutrition_goals',
  'meal_plans',
  'meal_plan_items',
  'supplement_protocols',
  'ai_conversations',
  'ai_messages',
  'ai_context_logs',
  'nutrition_knowledge_sources',
  'nutrition_knowledge_documents',
  'nutrition_knowledge_chunks',
  'push_subscriptions',
  'workouts',
  'workout_logs',
] as const;

const REQUIRED_FUNCTIONS = [
  'get_recent_food_logs',
  'get_recent_hydration_logs',
  'get_latest_body_metrics',
  'search_nutrition_knowledge',
] as const;

export async function runDbCheck(context: CheckContext): Promise<CheckResult> {
  const db = createClient(context.supabaseUrl, context.serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Verificar tabelas obrigatórias
  const missingTables: string[] = [];
  for (const table of REQUIRED_TABLES) {
    const { error } = await db.from(table).select('id').limit(0);
    if (error && /does not exist|relation/.test(error.message)) {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    return {
      name: 'db_schema',
      status: 'ERROR',
      summary: `Tabelas ausentes no banco: ${missingTables.join(', ')}`,
      error: `Missing tables: ${missingTables.join(', ')}`,
      suggestion: 'Execute sql/003_nutrition_schema.sql e sql/004_nutrition_rls.sql no Supabase SQL Editor.',
    };
  }

  // 2. Verificar funções SQL obrigatórias
  const missingFunctions: string[] = [];
  for (const fn of REQUIRED_FUNCTIONS) {
    const { error } = await db.rpc(fn as string, { p_user_id: '00000000-0000-0000-0000-000000000000', p_limit: 1 });
    if (error && /function.*does not exist/i.test(error.message)) {
      missingFunctions.push(fn);
    }
  }

  if (missingFunctions.length > 0) {
    return {
      name: 'db_functions',
      status: 'ERROR',
      summary: `Funções SQL ausentes: ${missingFunctions.join(', ')}`,
      error: `Missing functions: ${missingFunctions.join(', ')}`,
      suggestion: 'Execute sql/005_nutrition_functions.sql no Supabase SQL Editor.',
    };
  }

  // 3. Verificar função de busca vetorial
  const { error: ragError } = await db.rpc('search_nutrition_knowledge', {
    search_query: 'test',
    match_count: 1,
    category_filter: null,
  });

  if (ragError && /function.*does not exist/i.test(ragError.message)) {
    return {
      name: 'db_rag',
      status: 'ERROR',
      summary: 'Função de busca semântica ausente.',
      error: ragError.message,
      suggestion: 'Execute sql/005_nutrition_functions.sql para criar search_nutrition_knowledge.',
    };
  }

  // 4. Verificar se há chunks com embedding nulo (RAG inoperante)
  const { data: nullChunks, error: nullChunksError } = await db
    .from('nutrition_knowledge_chunks')
    .select('id')
    .is('embedding', null)
    .limit(1);

  if (!nullChunksError && nullChunks && nullChunks.length > 0) {
    return {
      name: 'db_embeddings',
      status: 'WARNING',
      summary: 'Existem chunks com embedding nulo — busca semântica não funcionará corretamente.',
      suggestion: 'Execute o pipeline de geração de embeddings para popular a coluna embedding.',
    };
  }

  return {
    name: 'db_check',
    status: 'OK',
    summary: 'Banco, tabelas, funções SQL e embeddings verificados com sucesso.',
    details: {
      tablesChecked: REQUIRED_TABLES.length,
      functionsChecked: REQUIRED_FUNCTIONS.length,
    },
  };
}
