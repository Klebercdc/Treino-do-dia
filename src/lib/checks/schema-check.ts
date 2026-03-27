import { createClient } from '@supabase/supabase-js';
import type { CheckContext, CheckResult } from './types';

type TableProbe = {
  table: string;
  columns: string[];
};

const probes: TableProbe[] = [
  { table: 'profiles', columns: ['id', 'full_name', 'updated_at'] },
  { table: 'nutrition_goals', columns: ['id', 'user_id', 'active'] },
  { table: 'meal_plans', columns: ['id', 'user_id', 'active'] },
  { table: 'meal_plan_items', columns: ['id', 'meal_plan_id', 'sort_order'] },
  { table: 'user_food_logs', columns: ['id', 'user_id', 'consumed_at'] },
  { table: 'hydration_logs', columns: ['id', 'user_id', 'water_ml'] },
  { table: 'body_metrics', columns: ['id', 'user_id', 'measured_at'] },
  { table: 'supplement_protocols', columns: ['id', 'user_id', 'active'] },
  { table: 'ai_conversations', columns: ['id', 'user_id', 'updated_at'] },
  { table: 'ai_messages', columns: ['id', 'conversation_id', 'user_id', 'role'] },
  { table: 'ai_context_logs', columns: ['id', 'user_id', 'conversation_id', 'query_text'] },
  { table: 'nutrition_knowledge_sources', columns: ['id', 'title', 'status'] },
  { table: 'nutrition_knowledge_documents', columns: ['id', 'source_id', 'checksum'] },
  { table: 'nutrition_knowledge_chunks', columns: ['id', 'document_id', 'source_id', 'embedding'] },
];

export async function runSchemaCheck(context: CheckContext): Promise<CheckResult> {
  const db = createClient(context.supabaseUrl, context.serviceRoleKey, { auth: { persistSession: false } });
  const missing: Array<{ table: string; reason: string }> = [];

  for (const probe of probes) {
    const { error } = await db.from(probe.table).select(probe.columns.join(',')).limit(1);
    if (error) {
      missing.push({ table: probe.table, reason: error.message });
    }
  }

  if (missing.length) {
    return {
      name: 'schema_tabelas_colunas',
      status: 'ERROR',
      summary: 'Falha na validação de tabelas/colunas obrigatórias.',
      details: { missing },
      suggestion: 'Revise migrations 002-005 e aplique novamente com supabase db push.',
    };
  }

  return {
    name: 'schema_tabelas_colunas',
    status: 'OK',
    summary: 'Tabelas e colunas essenciais estão acessíveis.',
    details: { tablesValidated: probes.length },
  };
}
