import { createClient } from '@supabase/supabase-js';
import { runAiChecks } from '../lib/checks/ai-check';
import { runDbChecks } from '../lib/checks/db-check';
import { buildCheckContextFromEnv } from '../lib/checks/env-check';
import { runRlsChecks } from '../lib/checks/rls-check';
import { CheckResult, RuntimeContext } from '../lib/checks/types';
import { runVectorChecks } from '../lib/checks/vector-check';

function printResult(result: CheckResult): void {
  const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
  console.log(`\n${icon} ${result.step}`);
  console.log(`Status: ${result.status}`);
  console.log(`Descrição: ${result.description}`);
  if (result.error) console.log(`Erro: ${result.error}`);
  if (result.suggestion) console.log(`Sugestão: ${result.suggestion}`);
  if (result.suggestedSql) console.log(`SQL sugerido:\n${result.suggestedSql}`);
  if (result.details) console.log(`Detalhes: ${JSON.stringify(result.details, null, 2)}`);
  if (typeof result.durationMs === 'number') console.log(`Duração: ${result.durationMs}ms`);
}

function overallStatus(results: CheckResult[]): 'OK' | 'WARNING' | 'ERROR' {
  if (results.some((result) => result.status === 'ERROR')) return 'ERROR';
  if (results.some((result) => result.status === 'WARNING')) return 'WARNING';
  return 'OK';
}

async function cleanup(runtime: RuntimeContext): Promise<void> {
  const ctx = runtime.checkContext;
  const service = createClient(ctx.supabaseUrl, ctx.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const safeDelete = async (fn: () => unknown) => {
    try {
      await Promise.resolve(fn() as Promise<unknown>);
    } catch {
      // cleanup best effort
    }
  };

  const testUserAId = runtime.state.testUserAId as string | undefined;
  const testUserBId = runtime.state.testUserBId as string | undefined;
  const vectorChunkId = runtime.state.vectorTestChunkId as string | undefined;
  const vectorDocId = runtime.state.vectorTestDocumentId as string | undefined;
  const vectorSourceId = runtime.state.vectorTestSourceId as string | undefined;
  const aiConversationId = runtime.state.aiConversationId as string | undefined;

  if (aiConversationId) {
    await safeDelete(() => service.from('ai_conversations').delete().eq('id', aiConversationId));
  }

  if (vectorChunkId) await safeDelete(() => service.from('nutrition_knowledge_chunks').delete().eq('id', vectorChunkId));
  if (vectorDocId) await safeDelete(() => service.from('nutrition_knowledge_documents').delete().eq('id', vectorDocId));
  if (vectorSourceId) await safeDelete(() => service.from('nutrition_knowledge_sources').delete().eq('id', vectorSourceId));

  if (testUserAId) {
    await safeDelete(() => service.from('nutrition_goals').delete().eq('user_id', testUserAId));
    await safeDelete(() => service.from('profiles').delete().eq('id', testUserAId));
    await safeDelete(() => service.auth.admin.deleteUser(testUserAId));
  }

  if (testUserBId) {
    await safeDelete(() => service.from('nutrition_goals').delete().eq('user_id', testUserBId));
    await safeDelete(() => service.from('profiles').delete().eq('id', testUserBId));
    await safeDelete(() => service.auth.admin.deleteUser(testUserBId));
  }
}

async function run(): Promise<void> {
  const startedAt = Date.now();
  const results: CheckResult[] = [];

  const { checkContext, result: envResult } = buildCheckContextFromEnv();
  results.push(envResult);
  printResult(envResult);

  if (!checkContext) {
    console.log('\nSTATUS GERAL: ERROR');
    process.exitCode = 1;
    return;
  }

  const runtime: RuntimeContext = {
    checkContext,
    state: {},
  };

  try {
    const stagedResults = [
      ...(await runDbChecks(runtime)),
      ...(await runRlsChecks(runtime)),
      ...(await runVectorChecks(runtime)),
      ...(await runAiChecks(runtime)),
    ];

    for (const item of stagedResults) {
      results.push(item);
      printResult(item);
    }
  } finally {
    await cleanup(runtime);
  }

  const status = overallStatus(results);
  const durationMs = Date.now() - startedAt;

  console.log('\n========================');
  console.log('11. RELATÓRIO FINAL');
  console.log('========================');
  console.log(`STATUS GERAL: ${status}`);
  console.log(`Total de etapas: ${results.length}`);
  console.log(`OK: ${results.filter((r) => r.status === 'OK').length}`);
  console.log(`WARNING: ${results.filter((r) => r.status === 'WARNING').length}`);
  console.log(`ERROR: ${results.filter((r) => r.status === 'ERROR').length}`);
  console.log(`Tempo total: ${durationMs}ms`);

  console.log('\nRelatório JSON estruturado:');
  console.log(JSON.stringify({ status, durationMs, results }, null, 2));

  if (status === 'ERROR') {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('❌ Falha fatal no system check:', error);
  process.exit(1);
});
