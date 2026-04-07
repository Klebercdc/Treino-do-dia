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
