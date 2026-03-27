import { createClient } from '@supabase/supabase-js';
import type { CheckContext, CheckResult } from './types';

export async function runDbCheck(context: CheckContext): Promise<CheckResult> {
  const db = createClient(context.supabaseUrl, context.serviceRoleKey, { auth: { persistSession: false } });

  const tableProbe = await db.from('profiles').select('id').limit(1);
  if (tableProbe.error) {
    return {
      name: 'db_conexao',
      status: 'ERROR',
      summary: 'Falha na conexão com banco/tabela base.',
      error: tableProbe.error.message,
    };
  }

  const fnProbe = await db.rpc('get_recent_food_logs', { p_user_id: '00000000-0000-0000-0000-000000000000', p_limit: 1 });
  if (fnProbe.error && !/invalid input syntax|violates row-level security/i.test(fnProbe.error.message)) {
    return {
      name: 'db_conexao',
      status: 'WARNING',
      summary: 'Conexão ok, mas função SQL de apoio não respondeu como esperado.',
      error: fnProbe.error.message,
      suggestion: 'Reaplicar migration 009_functions.sql.',
    };
  }

  return {
    name: 'db_conexao',
    status: 'OK',
    summary: 'Conexão com banco e funções SQL básicas disponíveis.',
  };
}
