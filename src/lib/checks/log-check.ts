import { createClient } from '@supabase/supabase-js';
import type { CheckContext, CheckResult } from './types';

export async function runLogCheck(context: CheckContext): Promise<CheckResult> {
  const db = createClient(context.supabaseUrl, context.serviceRoleKey, { auth: { persistSession: false } });
  const { count, error } = await db.from('ai_context_logs').select('id', { count: 'exact', head: true });

  if (error) {
    return {
      name: 'logs_ai_context',
      status: 'ERROR',
      summary: 'Não foi possível validar ai_context_logs.',
      error: error.message,
      suggestion: 'Verificar criação da tabela ai_context_logs e permissões.',
    };
  }

  return {
    name: 'logs_ai_context',
    status: 'OK',
    summary: 'Tabela de logs de contexto está acessível.',
    details: { totalRows: count ?? 0 },
  };
}
