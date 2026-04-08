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

test('acquireLabReportProcessingLock impede corrida quando status mudou', async () => {
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

  assert.equal(acquired, false);
});

test('canAcquireProcessingLock permite retomada de processing stale (> 20 min)', async () => {
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

test('rota de detalhe aplica filtro de ownership por user_id', () => {
  const routeSource = readFileSync('src/app/api/kronia/labs/reports/[id]/route.ts', 'utf-8');
  assert.match(routeSource, /\.eq\('user_id',\s*input\.userId\)/);
});

test('upload usa Supabase como gatilho primário e não despacha /api/labs/process', () => {
  const routeSource = readFileSync('src/app/api/labs/upload/route.ts', 'utf-8');
  assert.match(routeSource, /supabase_db_trigger/);
  assert.doesNotMatch(routeSource, /\/api\/labs\/process/);
  assert.doesNotMatch(routeSource, /enqueueLabReportProcessing\(/);
});

test('watchdog cron standalone ainda existe apenas para fallback manual na Vercel', () => {
  const source = readFileSync('src/app/api/cron/labs-watchdog/route.ts', 'utf-8');
  assert.match(source, /runLabsWatchdogTask/);
  assert.match(source, /NÃO USE como automação frequente/i);
});

test('daily-dispatch da Vercel não é mecanismo primário de exames', () => {
  const source = readFileSync('src/app/api/cron/daily-dispatch/route.ts', 'utf-8');
  assert.match(source, /ENABLE_VERCEL_LABS_WATCHDOG_FALLBACK/);
  assert.match(source, /supabase_pg_cron_primary/);
  assert.match(source, /runLabsWatchdogVercelFallback/);
});

test('labs/process define maxDuration para suportar OCR de até 45 s sem timeout', () => {
  const source = readFileSync('src/app/api/labs/process/route.ts', 'utf-8');
  assert.match(source, /export const maxDuration\s*=\s*60/);
});

test('labs-watchdog define maxDuration para não abortar processamento inline', () => {
  const source = readFileSync('src/app/api/cron/labs-watchdog/route.ts', 'utf-8');
  assert.match(source, /export const maxDuration\s*=\s*60/);
});

test('budget: timeout padrão de OCR + overhead operacional cabe no maxDuration da rota', () => {
  const serviceSource = readFileSync('src/server/internal/labReports/service.ts', 'utf-8');
  const processSource = readFileSync('src/app/api/labs/process/route.ts', 'utf-8');

  const ocrMatch = serviceSource.match(/EXAM_OCR_TIMEOUT_MS\s*\|\|\s*(\d+)/);
  const durMatch = processSource.match(/export const maxDuration\s*=\s*(\d+)/);

  assert.ok(ocrMatch, 'EXAM_OCR_TIMEOUT_MS default deve estar declarado em service.ts');
  assert.ok(durMatch, 'maxDuration deve estar declarado em labs/process/route.ts');

  const ocrDefaultMs = Number(ocrMatch![1]);
  const maxDurationMs = Number(durMatch![1]) * 1000;
  const OVERHEAD_MS = 5_000;

  assert.ok(
    ocrDefaultMs + OVERHEAD_MS <= maxDurationMs,
    `OCR padrão (${ocrDefaultMs} ms) + overhead (${OVERHEAD_MS} ms) deve caber em maxDuration (${maxDurationMs} ms).`,
  );
});

test('labs/process loga skip com reason correto', () => {
  const source = readFileSync('src/app/api/labs/process/route.ts', 'utf-8');
  assert.match(source, /reason.*already_analyzed/);
  assert.match(source, /reason.*lock_not_acquired/);
  assert.doesNotMatch(source, /reason.*already_processing/);
});

test('parser legado não usa mais OpenAI nem PDF bruto em LLM', () => {
  const source = readFileSync('src/core/labs/labParser.ts', 'utf-8');
  assert.match(source, /desativado/i);
  assert.doesNotMatch(source, /OPENAI_API_KEY/);
  assert.doesNotMatch(source, /api\.openai\.com/);
  assert.doesNotMatch(source, /input_file/);
});

test('dispatch do watchdog do Supabase existe na migration nova', () => {
  const source = readFileSync('supabase/migrations/039_lab_reports_supabase_orchestration.sql', 'utf-8');
  assert.match(source, /dispatch_lab_report_to_edge/);
  assert.match(source, /cron\.schedule\(/);
  assert.match(source, /lab-report-orchestrator\/watchdog/);
});
