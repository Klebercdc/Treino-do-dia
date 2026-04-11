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

test('frontend labs usa init-upload + upload assinado + register (sem multipart backend)', () => {
  const source = readFileSync('app.js', 'utf-8');
  assert.match(source, /\/api\/kronia\/labs\/init-upload/);
  assert.match(source, /uploadToSignedUrl/);
  assert.match(source, /\/api\/kronia\/labs\/register/);
  assert.doesNotMatch(source, /\/api\/kronia\/labs\/upload/);
});

test('storagePath canônico de labs é {userId}/{uuid}.{ext} e alinhado com policy', () => {
  const source = readFileSync('src/core/labs/labRepository.ts', 'utf-8');
  assert.match(source, /randomUUID/);
  assert.match(source, /return `\$\{userId\}\/\$\{randomUUID\(\)\}\$\{ext\}`/);
  assert.doesNotMatch(source, /Date\.now\(/);

  const canonicalRe = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/;
  assert.match('550e8400-e29b-41d4-a716-446655440000/4d7f0b88-7f6c-4f8d-b40d-8d72d3454c1a.pdf', canonicalRe);
  assert.doesNotMatch('550e8400-e29b-41d4-a716-446655440000/1712611111111-exame.pdf', canonicalRe);
});

test('frontend labs usa rota interna same-origin para register/history e cleanup de órfão no bucket', () => {
  const source = readFileSync('app.js', 'utf-8');
  assert.match(source, /resolveInternalApiPath\('\/api\/kronia\/labs\/register'\)/);
  assert.match(source, /resolveInternalApiPath\('\/api\/kronia\/labs\/reports\?limit=10'\)/);
  assert.match(source, /_sb\.storage\.from\('lab-reports'\)\.remove\(\[storagePath\]\)/);
});

test('register valida existência de objeto no storage e middleware não intercepta labs', () => {
  const registerSource = readFileSync('src/app/api/kronia/labs/register/route.ts', 'utf-8');
  const middlewareSource = readFileSync('src/middleware.ts', 'utf-8');

  assert.match(registerSource, /ensureObjectExistsInStorage/);
  assert.match(registerSource, /Arquivo não encontrado no storage/);
  assert.match(registerSource, /deleteLabReportRecord/);
  assert.match(registerSource, /requireBearerAuth/);

  assert.match(middlewareSource, /\/api\/kronia\/labs\/register/);
  assert.match(middlewareSource, /\/api\/kronia\/labs\/reports/);
  assert.doesNotMatch(middlewareSource, /\/api\/kronia\/labs\/upload/);
  assert.doesNotMatch(middlewareSource, /\/api\/labs\/upload/);
});

test('policy do bucket lab-reports exige owner + prefixo user + arquivo uuid.ext', () => {
  const source = readFileSync('supabase/migrations/041_lab_reports_storage_owner_path_policy.sql', 'utf-8');
  assert.match(source, /bucket_id = 'lab-reports'/);
  assert.match(source, /owner = auth\.uid\(\)/);
  assert.match(source, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  assert.match(source, /name ~ '\^\[0-9a-f-\]\{36\}\/\[0-9a-f-\]\{36\}\\\.\[a-z0-9\]\{1,10\}\$'/);
});

test('vercel rewrites de labs apontam para handler serverless único em /api/system', () => {
  const source = readFileSync('vercel.json', 'utf-8');
  assert.match(source, /kronia-labs-init-upload/);
  assert.match(source, /kronia-labs-register/);
  assert.match(source, /kronia-labs-reports/);
  assert.match(source, /kronia-labs-report-by-id/);
});

test('api/system roteia vertical de labs para handlers reais de produção', () => {
  const source = readFileSync('api/system.js', 'utf-8');
  assert.match(source, /handleInitUpload/);
  assert.match(source, /handleRegister/);
  assert.match(source, /handleReports/);
  assert.match(source, /handleReportById/);
});

test('service de labs usa parse_status alinhado ao contrato novo', () => {
  const source = readFileSync('src/server/internal/labReports/service.ts', 'utf-8');
  assert.doesNotMatch(source, /parse_status:\s*'pending'/);
  assert.doesNotMatch(source, /parse_status:\s*'parsed'/);
  assert.match(source, /parse_status:\s*'uploaded'/);
  assert.match(source, /parse_status:\s*'processing'/);
  assert.match(source, /parse_status:\s*'processed'/);
});

test('edge function de labs usa fallback canônico de OCR na própria app', () => {
  const source = readFileSync('supabase/functions/lab-report-orchestrator/index.ts', 'utf-8');
  assert.match(source, /resolveExamOcrBaseUrl/);
  assert.match(source, /api\/exam_ocr/);
});

test('edge function trata tabelas auxiliares de labs como opcionais', () => {
  const source = readFileSync('supabase/functions/lab-report-orchestrator/index.ts', 'utf-8');
  assert.match(source, /lab_report_extractions/);
  assert.match(source, /lab_report_biomarkers/);
  assert.match(source, /PGRST205/);
  assert.match(source, /buildNormalizedPayload/);
});

test('service interna define o shape canônico de ai_insights usado como fonte de verdade', () => {
  const source = readFileSync('src/server/internal/labReports/service.ts', 'utf-8');
  assert.match(source, /health_profile/);
  assert.match(source, /clinical_flags/);
  assert.match(source, /critical_flags/);
  assert.match(source, /impact_on_training/);
  assert.match(source, /impact_on_nutrition/);
  assert.match(source, /impact_on_supplementation/);
  assert.match(source, /recovery_signals/);
  assert.match(source, /safety_notes/);
  assert.match(source, /recommended_follow_up/);
});
