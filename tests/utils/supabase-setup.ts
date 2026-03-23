/**
 * KRONIA — Global Setup dos Testes E2E
 *
 * Executado UMA vez antes de todos os testes.
 * Conecta ao Supabase de testes (Service Role) e limpa as tabelas
 * para garantir um banco em estado zero a cada execução.
 *
 * Requer em .env.test:
 *   VITE_SUPABASE_URL_TEST
 *   VITE_SUPABASE_SERVICE_KEY_TEST
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const SUPABASE_URL   = process.env.VITE_SUPABASE_URL_TEST   || '';
const SERVICE_KEY    = process.env.VITE_SUPABASE_SERVICE_KEY_TEST || '';

async function globalSetup(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn(
      '\n⚠️  VITE_SUPABASE_URL_TEST ou VITE_SUPABASE_SERVICE_KEY_TEST não configurados.\n' +
      '   Preencha o .env.test e rode novamente.\n' +
      '   Os testes continuarão, mas sem limpeza do banco.\n'
    );
    return;
  }

  console.log('\n🧹 Iniciando limpeza do banco de testes...');
  console.log(`   URL: ${SUPABASE_URL}`);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Ordem respeita FK constraints (CASCADE cuida das dependências,
  // mas deletamos explicitamente para clareza e segurança)
  const tabelas: string[] = [
    'workout_logs',
    'personal_records',
    'workouts',
    'exercises',
  ];

  for (const tabela of tabelas) {
    // Deleta todos os registros (neq com UUID impossível = seleciona tudo)
    const { error, count } = await sb
      .from(tabela)
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.warn(`   ⚠️  ${tabela}: ${error.message}`);
    } else {
      console.log(`   ✅ ${tabela} limpa (${count ?? 0} registros removidos)`);
    }
  }

  // Remove usuários de teste (domínio @test.kronia)
  try {
    const { data: { users }, error: listErr } = await sb.auth.admin.listUsers({
      perPage: 100,
    });

    if (!listErr && users) {
      const testUsers = users.filter(u => u.email?.endsWith('@test.kronia'));
      for (const user of testUsers) {
        await sb.auth.admin.deleteUser(user.id);
        console.log(`   ✅ Usuário de teste removido: ${user.email}`);
      }
    }
  } catch {
    // admin.listUsers pode não estar disponível dependendo das permissões
    console.warn('   ℹ️  Limpeza de usuários de teste ignorada (permissões insuficientes)');
  }

  console.log('✅ Banco de testes pronto\n');
}

export default globalSetup;
