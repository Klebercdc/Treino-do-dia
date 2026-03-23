/**
 * KRONIA — Teste de Sanidade (Sanity Check)
 *
 * Objetivo: verificar que o app está apontando para o banco correto.
 * Não faz INSERT nem SELECT — apenas lê a URL do cliente Supabase ativo.
 *
 * Resultado esperado: a URL impressa deve coincidir com VITE_SUPABASE_URL_TEST.
 * Se imprimir a URL de produção, o isolamento falhou.
 */

import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

test('sanity: imprime a URL do Supabase ativo no browser', async ({ page }) => {
  const urlTest = process.env.VITE_SUPABASE_URL_TEST || '';

  await page.goto('/');

  // Aguarda o splash desaparecer (auto-hide em 3.5s)
  await page.waitForSelector('#splashScreen', {
    state: 'hidden',
    timeout: 12_000,
  }).catch(() => {
    // Splash pode já ter sumido
  });

  // Captura a URL que o cliente _sb está usando
  const supabaseUrl = await page.evaluate((): string => {
    const client = (window as any)._sb;
    if (!client) return 'CLIENTE_NAO_ENCONTRADO';

    // supabase-js v2 expõe a URL em diferentes lugares
    return (
      client.supabaseUrl ||
      client.restUrl ||
      client.rest?.url ||
      (client as any)._url ||
      'URL_NAO_ACESSIVEL'
    );
  });

  const separator = '═'.repeat(50);
  console.log(`\n${separator}`);
  console.log('🔍  SANITY CHECK — Roteamento do Supabase');
  console.log(separator);
  console.log(`  URL ativa no browser : ${supabaseUrl}`);
  console.log(`  URL esperada (teste) : ${urlTest || '(não configurada)'}`);

  if (!urlTest) {
    console.log('\n  ⚠️  VITE_SUPABASE_URL_TEST não preenchido no .env.test');
    console.log('  Preencha o .env.test e rode novamente para validar o roteamento.');
  } else if (supabaseUrl === urlTest) {
    console.log('\n  ✅ ROTEAMENTO CORRETO — banco de testes ativo');
  } else if (supabaseUrl.includes('CLIENTE') || supabaseUrl.includes('URL_NAO')) {
    console.log('\n  ℹ️  Cliente Supabase não exposto no window.');
    console.log('  O app usa chave hardcoded em auth.js.');
    console.log('  Ação necessária: refatorar auth.js para ler URL do environment.');
    console.log('  (veja README de testes para instruções)');
  } else {
    console.log('\n  ❌ ATENÇÃO: app pode estar usando banco de PRODUÇÃO!');
    console.log('  Verifique auth.js e o isolamento de credenciais.');
  }

  console.log(`${separator}\n`);
});
