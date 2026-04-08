import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  acquireLabReportProcessingLock,
  computeReadinessForAI,
  invokeExamOcrService,
  processLabReportUploadSafely,
} from '../../src/server/internal/labReports/service';

test('computeReadinessForAI marca needs_review sem biomarcadores', () => {
  const result = computeReadinessForAI({ biomarkers: [], confidenceSummary: { mean_confidence: 0.95 } });
  assert.equal(result.ready, false);
  assert.equal(result.needsReview, true);
});

test('computeReadinessForAI marca needs_review com baixa confiança', () => {
  const result = computeReadinessForAI({
    biomarkers: [{ marker_key: 'glucose', value_numeric: 99 }],
    confidenceSummary: { mean_confidence: 0.4 },
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'low_confidence');
});

test('computeReadinessForAI permite IA com confiança e biomarcadores', () => {
  const result = computeReadinessForAI({
    biomarkers: [{ marker_key: 'glucose', value_numeric: 95 }],
    confidenceSummary: { mean_confidence: 0.83 },
  });
  assert.equal(result.ready, true);
  assert.equal(result.needsReview, false);
});

test('invokeExamOcrService falha quando OCR retorna success=false em HTTP 200', async () => {
  const originalFetch = global.fetch;
  process.env.EXAM_OCR_SERVICE_URL = 'http://ocr.local';
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: false,
        source_type: 'pdf',
        extraction_mode: 'failed',
        raw_text: '',
        pages: [],
        blocks: [],
        rows: [],
        biomarkers_detected: [],
        confidence_summary: {},
        warnings: ['ocr_failed'],
        metadata: {},
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  await assert.rejects(
    () =>
      invokeExamOcrService({
        sourceId: 'lab-1',
        mimeType: 'application/pdf',
        fileUrl: 'http://file.local/a.pdf',
      }),
    /success=false/,
  );

  global.fetch = originalFetch;
});

test('processLabReportUploadSafely marca failed em falha operacional', async () => {
  const originalFetch = global.fetch;
  process.env.EXAM_OCR_SERVICE_URL = 'http://ocr.local';
  global.fetch = (async () => new Response('erro', { status: 500 })) as typeof fetch;

  const updates: Array<Record<string, unknown>> = [];
  const admin = {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: 'http://file.local/report.pdf' }, error: null }),
      }),
    },
    from: (table: string) => ({
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          if (table === 'lab_reports') updates.push(payload);
          return { error: null };
        },
      }),
    }),
  } as any;

  const result = await processLabReportUploadSafely(admin, {
    labReportId: 'lab-2',
    storageBucket: 'lab-reports',
    storagePath: 'u/file.pdf',
    mimeType: 'application/pdf',
  });

  assert.equal(result.status, 'failed');
  assert.equal(updates.some((item) => item.status === 'failed'), true);
  global.fetch = originalFetch;
});

test('distinção needs_review vs failed permanece coerente', () => {
  const needsReview = computeReadinessForAI({
    biomarkers: [{ marker_key: 'glucose', value_numeric: 92 }],
    confidenceSummary: { mean_confidence: 0.2 },
    warnings: [],
  });

  const ok = computeReadinessForAI({
    biomarkers: [{ marker_key: 'glucose', value_numeric: 92 }],
    confidenceSummary: { mean_confidence: 0.92 },
    warnings: [],
  });

  assert.equal(needsReview.needsReview, true);
  assert.equal(needsReview.reason, 'low_confidence');
  assert.equal(ok.ready, true);
});

test('rota de detalhe aplica filtro de ownership por user_id', () => {
  const routeSource = readFileSync('src/app/api/kronia/labs/reports/[id]/route.ts', 'utf-8');
  assert.match(routeSource, /\.eq\('user_id',\s*input\.userId\)/);
});

test('upload despacha processamento desacoplado e não executa pipeline inline', () => {
  const routeSource = readFileSync('src/app/api/labs/upload/route.ts', 'utf-8');
  assert.match(routeSource, /\/api\/labs\/process/);
  assert.doesNotMatch(routeSource, /processLabReportUpload\(/);
});

test('acquireLabReportProcessingLock impede corrida quando status mudou', async () => {
  // Simula resposta real do Supabase: 0 linhas afetadas (outro processo já mudou o status)
  const chain = {
    eq: () => chain,
    select: () => chain,
    limit: async () => ({ data: [], error: null }),
  } as any;
  const admin = {
    from: () => ({
      update: () => chain,
    }),
  } as any;

  const acquired = await acquireLabReportProcessingLock(admin, {
    labReportId: 'lab-3',
    currentStatus: 'uploaded',
    updatedAt: new Date().toISOString(),
  });

  assert.equal(acquired, false);
});

test('acquireLabReportProcessingLock adquire quando 1 linha é atualizada', async () => {
  const chain = {
    eq: () => chain,
    select: () => chain,
    limit: async () => ({ data: [{ id: 'lab-4' }], error: null }),
  } as any;
  const admin = {
    from: () => ({
      update: () => chain,
    }),
  } as any;

  const acquired = await acquireLabReportProcessingLock(admin, {
    labReportId: 'lab-4',
    currentStatus: 'uploaded',
    updatedAt: new Date().toISOString(),
  });

  assert.equal(acquired, true);
});

test('canAcquireProcessingLock bloqueia processing recente (não está stale)', async () => {
  // processing com updated_at de 5 minutos atrás — NÃO deve ser retomado
  const recentUpdatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const chain = {
    eq: () => chain,
    select: () => chain,
    limit: async () => ({ data: [], error: null }),
  } as any;
  const admin = {
    from: () => ({ update: () => chain }),
  } as any;

  const acquired = await acquireLabReportProcessingLock(admin, {
    labReportId: 'lab-5',
    currentStatus: 'processing',
    updatedAt: recentUpdatedAt,
  });

  // canAcquireProcessingLock retorna false para processing recente → não deve chegar ao DB
  assert.equal(acquired, false);
});

test('canAcquireProcessingLock permite retomada de processing stale (> 20 min)', async () => {
  // processing com updated_at de 30 minutos atrás — deve ser retomado
  const staleUpdatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const chain = {
    eq: () => chain,
    select: () => chain,
    limit: async () => ({ data: [{ id: 'lab-6' }], error: null }),
  } as any;
  const admin = {
    from: () => ({ update: () => chain }),
  } as any;

  const acquired = await acquireLabReportProcessingLock(admin, {
    labReportId: 'lab-6',
    currentStatus: 'processing',
    updatedAt: staleUpdatedAt,
  });

  assert.equal(acquired, true);
});

test('watchdog cron para exames presos existe e exige autorização', () => {
  const source = readFileSync('src/app/api/cron/labs-watchdog/route.ts', 'utf-8');
  assert.match(source, /runLabsWatchdogTask/);
  assert.match(source, /isAuthorizedCronRequest/);

  const vercelConfig = readFileSync('vercel.json', 'utf-8');
  assert.equal(vercelConfig.includes('"path": "/api/cron/daily-dispatch"'), true);
  assert.equal(vercelConfig.includes('"path": "/api/cron/labs-watchdog"'), false);
});

test('home mantém CTA visível para entrada de Exames', () => {
  const html = readFileSync('index.html', 'utf-8');
  assert.match(html, /home-labs-cta-card/);
  assert.match(html, /Enviar exames agora/);
});

test('lock de processamento usa updated_at para CAS forte', () => {
  const source = readFileSync('src/server/internal/labReports/service.ts', 'utf-8');
  assert.match(source, /\.eq\('updated_at', input\.updatedAt\)/);
});

test('dispatcher diário centraliza tarefas de cron e usa dispatch não-bloqueante para watchdog', () => {
  const source = readFileSync('src/app/api/cron/daily-dispatch/route.ts', 'utf-8');
  // Watchdog usa dispatch (não inline) para não consumir o budget de 60 s do cron diário
  assert.match(source, /runLabsWatchdogDispatchTask/);
  assert.doesNotMatch(source, /runLabsWatchdogTask\b/);
  assert.match(source, /runExerciseSyncTask/);
  assert.match(source, /auto_import_exercises/);
  assert.match(source, /memory_queue_worker/);
});

test('labs-watchdog standalone ainda usa processamento inline para trigger manual', () => {
  const source = readFileSync('src/app/api/cron/labs-watchdog/route.ts', 'utf-8');
  assert.match(source, /runLabsWatchdogTask\b/);
  assert.doesNotMatch(source, /runLabsWatchdogDispatchTask/);
});

test('labs/process define maxDuration para suportar OCR de até 45 s sem timeout', () => {
  const source = readFileSync('src/app/api/labs/process/route.ts', 'utf-8');
  // Sem maxDuration explícito, Next.js usa ~15 s — OCR seria silenciosamente abortado
  assert.match(source, /export const maxDuration\s*=\s*60/);
});

test('labs-watchdog define maxDuration para não abortar processamento inline', () => {
  const source = readFileSync('src/app/api/cron/labs-watchdog/route.ts', 'utf-8');
  assert.match(source, /export const maxDuration\s*=\s*60/);
});

test('budget: timeout padrão de OCR + overhead operacional cabe no maxDuration da rota', () => {
  // Garante que uma mudança em EXAM_OCR_TIMEOUT_MS ou maxDuration não cria
  // incompatibilidade silenciosa — OCR abortado antes de concluir.
  const serviceSource = readFileSync('src/server/internal/labReports/service.ts', 'utf-8');
  const processSource = readFileSync('src/app/api/labs/process/route.ts', 'utf-8');

  const ocrMatch = serviceSource.match(/EXAM_OCR_TIMEOUT_MS\s*\|\|\s*(\d+)/);
  const durMatch = processSource.match(/export const maxDuration\s*=\s*(\d+)/);

  assert.ok(ocrMatch, 'EXAM_OCR_TIMEOUT_MS default deve estar declarado em service.ts');
  assert.ok(durMatch, 'maxDuration deve estar declarado em labs/process/route.ts');

  const ocrDefaultMs = Number(ocrMatch![1]);
  const maxDurationMs = Number(durMatch![1]) * 1000;
  const OVERHEAD_MS = 5_000; // signed URL + DB (lock, persist, analyze) + logging + rede

  assert.ok(
    ocrDefaultMs + OVERHEAD_MS <= maxDurationMs,
    `OCR padrão (${ocrDefaultMs} ms) + overhead (${OVERHEAD_MS} ms) = ${ocrDefaultMs + OVERHEAD_MS} ms `
    + `deve caber em maxDuration (${maxDurationMs} ms). `
    + `Ajuste EXAM_OCR_TIMEOUT_MS ou maxDuration se mudar um dos valores.`,
  );
});

test('labs/process loga skip com reason correto (não usa "already_processing" para estado não-processing)', () => {
  const source = readFileSync('src/app/api/labs/process/route.ts', 'utf-8');
  // Reason deve ser descritivo — não "already_processing" para estados como extracted/analyzed
  assert.match(source, /reason.*already_analyzed/);
  assert.match(source, /reason.*lock_not_acquired/);
  assert.doesNotMatch(source, /reason.*already_processing/);
});

test('dispatch de upload loga erro HTTP (não só falha de rede)', () => {
  const source = readFileSync('src/app/api/labs/upload/route.ts', 'utf-8');
  assert.match(source, /labs_upload_dispatch_http_error/);
  assert.match(source, /labs_upload_dispatch_failed/);
});

test('dispatch do watchdog loga erro HTTP (não só falha de rede)', () => {
  const source = readFileSync('src/server/internal/cron/dispatcher.ts', 'utf-8');
  assert.match(source, /labs_watchdog_dispatch_item_http_error/);
  assert.match(source, /labs_watchdog_dispatch_item_failed/);
});

test('Edge Function labs-watchdog existe e segue padrão do projeto', () => {
  const source = readFileSync('supabase/functions/labs-watchdog/index.ts', 'utf-8');
  // Autenticação via CRON_SECRET
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /Unauthorized/);
  // Consulta exames presos em processing
  assert.match(source, /status.*processing/);
  assert.match(source, /updated_at.*staleBefore/);
  // Despacha para /api/labs/process com timeout explícito
  assert.match(source, /\/api\/labs\/process/);
  assert.match(source, /DISPATCH_TIMEOUT_MS/);
  // Despacho paralelo (não serial)
  assert.match(source, /Promise\.allSettled/);
});

test('migration 039 agenda pg_cron a cada 15 minutos', () => {
  const sql = readFileSync('supabase/migrations/039_labs_watchdog_cron.sql', 'utf-8');
  assert.match(sql, /\*\/15 \* \* \* \*/);
  assert.match(sql, /labs-watchdog-every-15min/);
  assert.match(sql, /labs-watchdog/);
  assert.match(sql, /net\.http_post/);
});

test('config.toml desabilita JWT para labs-watchdog (autenticação própria via CRON_SECRET)', () => {
  const config = readFileSync('supabase/config.toml', 'utf-8');
  assert.match(config, /\[functions\.labs-watchdog\]/);
  // Localiza o bloco e verifica verify_jwt = false dentro dele
  const idx = config.indexOf('[functions.labs-watchdog]');
  const block = config.slice(idx, idx + 200);
  assert.match(block, /verify_jwt\s*=\s*false/);
});

test('workflow de deploy inclui labs-watchdog', () => {
  const workflow = readFileSync('.github/workflows/deploy-edge-functions.yml', 'utf-8');
  assert.match(workflow, /labs-watchdog/);
  assert.match(workflow, /supabase functions deploy labs-watchdog/);
});

test('middleware não possui assertServerEnv em nível de módulo (não quebra em env incompleto)', () => {
  const source = readFileSync('src/middleware.ts', 'utf-8');
  assert.doesNotMatch(source, /assertServerEnv/);
  // Continua exigindo Bearer token
  assert.match(source, /hasBearerToken/);
  assert.match(source, /unauthorized/);
});

test('rota register exige auth, valida MIME, bloqueia path traversal e verifica ownership', () => {
  const source = readFileSync('src/app/api/kronia/labs/register/route.ts', 'utf-8');
  // Auth obrigatória
  assert.match(source, /requireBearerAuth/);
  // Validação de MIME
  assert.match(source, /ALLOWED_MIME_TYPES/);
  // Ownership: path deve começar com userId do JWT
  assert.match(source, /startsWith.*auth\.user\.id/);
  // Bloqueio de path traversal
  assert.match(source, /includes\(['"]\.\.['"]?\)/);
  // Dispatch de processamento
  assert.match(source, /labs\/process/);
  assert.match(source, /CRON_SECRET/);
});

test('upload direto via Supabase Storage no frontend usa _sb.storage e registra via /register', () => {
  const source = readFileSync('app.js', 'utf-8');
  // Upload direto ao storage (sem multipart via Next.js)
  assert.match(source, /_sb\.storage\.from\('lab-reports'\)\.upload/);
  // Registro via nova rota JSON
  assert.match(source, /\/api\/kronia\/labs\/register/);
  // Não mais chama /upload com multipart
  assert.doesNotMatch(source, /\/api\/kronia\/labs\/upload/);
});
