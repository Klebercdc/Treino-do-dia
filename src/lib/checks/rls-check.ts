import { createClient } from '@supabase/supabase-js';
import type { CheckContext, CheckResult } from './types';

export async function runRlsCheck(context: CheckContext): Promise<CheckResult> {
  const anon = createClient(context.supabaseUrl, context.anonKey, { auth: { persistSession: false } });
  const admin = createClient(context.supabaseUrl, context.serviceRoleKey, { auth: { persistSession: false } });

  const { error: anonymousReadError } = await anon.from('profiles').select('id').limit(1);
  if (!anonymousReadError) {
    return {
      name: 'rls_isolamento',
      status: 'ERROR',
      summary: 'Acesso anônimo indevido detectado em tabela sensível.',
      suggestion: 'Garantir RLS ativo + policies com auth.uid() nas tabelas do usuário.',
    };
  }

  const stamp = Date.now();
  const userAEmail = `rls_a_${stamp}@kronia.local`;
  const userBEmail = `rls_b_${stamp}@kronia.local`;

  const { data: userA, error: userAError } = await admin.auth.admin.createUser({
    email: userAEmail,
    password: 'RlsCheck#12345',
    email_confirm: true,
  });

  if (userAError || !userA.user?.id) {
    return {
      name: 'rls_isolamento',
      status: 'WARNING',
      summary: 'Não foi possível criar usuário A para simulação de isolamento.',
      error: userAError?.message,
    };
  }

  const { data: userB, error: userBError } = await admin.auth.admin.createUser({
    email: userBEmail,
    password: 'RlsCheck#12345',
    email_confirm: true,
  });

  if (userBError || !userB.user?.id) {
    await admin.auth.admin.deleteUser(userA.user.id);
    return {
      name: 'rls_isolamento',
      status: 'WARNING',
      summary: 'Não foi possível criar usuário B para simulação de isolamento.',
      error: userBError?.message,
    };
  }

  try {
    const userAId = userA.user.id;
    const userBId = userB.user.id;

    const { error: seedGoalError } = await admin.from('nutrition_goals').insert({
      user_id: userAId,
      calories_target: 2100,
      active: true,
    });

    if (seedGoalError) {
      return {
        name: 'rls_isolamento',
        status: 'WARNING',
        summary: 'Não foi possível preparar dado para simulação de isolamento.',
        error: seedGoalError.message,
      };
    }

    const clientB = createClient(context.supabaseUrl, context.anonKey, { auth: { persistSession: false } });
    const { data: loginB, error: loginBError } = await clientB.auth.signInWithPassword({
      email: userBEmail,
      password: 'RlsCheck#12345',
    });

    if (loginBError || !loginB.session?.access_token) {
      return {
        name: 'rls_isolamento',
        status: 'WARNING',
        summary: 'Não foi possível autenticar usuário B para simulação cruzada.',
        error: loginBError?.message,
      };
    }

    const userBClient = createClient(context.supabaseUrl, context.anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${loginB.session.access_token}` } },
    });

    const { data: forbiddenData, error: forbiddenError } = await userBClient
      .from('nutrition_goals')
      .select('id,user_id')
      .eq('user_id', userAId);

    if (forbiddenError) {
      return {
        name: 'rls_isolamento',
        status: 'OK',
        summary: 'RLS bloqueou consulta cruzada com erro explícito.',
        details: { blockedMessage: forbiddenError.message },
      };
    }

    if ((forbiddenData ?? []).length > 0) {
      return {
        name: 'rls_isolamento',
        status: 'ERROR',
        summary: 'RLS falhou: usuário B conseguiu ler dados de usuário A.',
      };
    }

    return {
      name: 'rls_isolamento',
      status: 'OK',
      summary: 'RLS validado: usuário autenticado não acessa dados de outro usuário.',
    };
  } finally {
    await admin.from('nutrition_goals').delete().eq('user_id', userA.user.id);
    await admin.auth.admin.deleteUser(userA.user.id);
    await admin.auth.admin.deleteUser(userB.user.id);
  }
}
