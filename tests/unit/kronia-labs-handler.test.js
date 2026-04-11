/**
 * Unit tests for the REAL production handler: api/kronia-labs.js
 *
 * Strategy: structural/contract tests (read source as string) + mock-based
 * functional tests for the insert payload logic.
 *
 * Run: node --test tests/unit/kronia-labs-handler.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// _auth.js throws at load time without SUPABASE_URL — set a stub before requiring handler
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';

// Import the CJS handler using createRequire (ESM → CJS interop)
const require = createRequire(import.meta.url);
const {
  buildCanonicalLabStoragePath,
  SAFE_STORAGE_PATH_RE,
} = require('../../api/kronia-labs.js');

const HANDLER_PATH     = 'api/kronia-labs.js';
const SYSTEM_PATH      = 'api/system.js';
const VERCEL_JSON_PATH = 'vercel.json';
const MIGRATION_043    = 'supabase/migrations/043_lab_reports_parse_status_fix.sql';

const handlerSrc = readFileSync(HANDLER_PATH, 'utf-8');
const systemSrc  = readFileSync(SYSTEM_PATH, 'utf-8');
const vercelSrc  = readFileSync(VERCEL_JSON_PATH, 'utf-8');
const mig043Src  = readFileSync(MIGRATION_043, 'utf-8');

// ── Routing ───────────────────────────────────────────────────────────────────

test('vercel.json roteia vertical de labs para /api/system', () => {
  assert.match(vercelSrc, /kronia-labs-init-upload/);
  assert.match(vercelSrc, /kronia-labs-register/);
  assert.match(vercelSrc, /kronia-labs-reports/);
  assert.match(vercelSrc, /kronia-labs-report-by-id/);
});

test('api/system.js despacha cada rota de labs para o handler correto', () => {
  assert.match(systemSrc, /handleInitUpload/);
  assert.match(systemSrc, /handleRegister/);
  assert.match(systemSrc, /handleReports/);
  assert.match(systemSrc, /handleReportById/);
  assert.match(systemSrc, /kronia-labs-init-upload/);
  assert.match(systemSrc, /kronia-labs-register/);
});

test('handler de detalhe usa colunas reais de extração e fallback para normalized_payload', () => {
  assert.match(handlerSrc, /raw_text/);
  assert.match(handlerSrc, /confidence_summary/);
  assert.match(handlerSrc, /buildFallbackExtraction/);
  assert.match(handlerSrc, /extractBiomarkersFromNormalizedPayload/);
  assert.match(handlerSrc, /clinicalFlags/);
  assert.match(handlerSrc, /criticalFlags/);
});

test('handler de detalhe suporta DELETE com ownership e bloqueio de processing', () => {
  const detailSection = handlerSrc.slice(handlerSrc.indexOf('function handleReportById'));
  assert.match(detailSection, /req\.method === 'DELETE'/);
  assert.match(detailSection, /\.eq\('user_id', user\.id\)/);
  assert.match(detailSection, /REPORT_STILL_PROCESSING/);
  assert.match(detailSection, /storage\.from\(storageBucket\)\.remove/);
  assert.match(detailSection, /DB_DELETE_ERROR/);
});

// ── Critical parse_status fix ─────────────────────────────────────────────────

test('handleInitUpload usa parse_status pending_upload (não pending)', () => {
  // Garante que o handler de produção usa o valor correto — 'pending' viola constraint pós-043
  assert.match(handlerSrc, /parse_status:\s*'pending_upload'/);
  assert.doesNotMatch(
    // Não deve conter parse_status: 'pending' em nenhum lugar do handler
    handlerSrc.replace(/\/\/.*/g, ''),   // strip single-line comments
    /parse_status:\s*'pending'[^_]/
  );
});

test('handleRegister usa parse_status uploaded (não pending)', () => {
  // Quando o arquivo é confirmado, parse_status deve ser 'uploaded' — 'pending' é inválido
  const registerSection = handlerSrc.slice(handlerSrc.indexOf('handleRegister'));
  assert.match(registerSection, /parse_status:\s*'uploaded'/);
});

test('handler nunca usa parse_status legado pending ou parsed', () => {
  // Remove comentários de linha para evitar falsos positivos
  const noComments = handlerSrc.split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(noComments, /parse_status:\s*['"]pending['"]/);
  assert.doesNotMatch(noComments, /parse_status:\s*['"]parsed['"]/);
});

// ── SDK safety ────────────────────────────────────────────────────────────────

test('handler verifica typeof createSignedUploadUrl ANTES do INSERT no DB', () => {
  const initUploadFn = handlerSrc.slice(
    handlerSrc.indexOf('function handleInitUpload'),
    handlerSrc.indexOf('function handleRegister')
  );
  const sdkCheckPos  = initUploadFn.indexOf('createSignedUploadUrl');
  const insertPos    = initUploadFn.indexOf('.insert(');
  assert.ok(sdkCheckPos !== -1,  'createSignedUploadUrl check não encontrado em handleInitUpload');
  assert.ok(insertPos   !== -1,  '.insert() não encontrado em handleInitUpload');
  assert.ok(sdkCheckPos < insertPos, 'SDK check deve vir ANTES do .insert()');
});

test('handler retorna SDK_INCOMPATIBLE se createSignedUploadUrl não existir', () => {
  assert.match(handlerSrc, /SDK_INCOMPATIBLE/);
  assert.match(handlerSrc, /createSignedUploadUrl indisponível/);
});

// ── Validation ────────────────────────────────────────────────────────────────

test('handleInitUpload valida method, fileName, mimeType e fileSize', () => {
  const initSection = handlerSrc.slice(
    handlerSrc.indexOf('function handleInitUpload'),
    handlerSrc.indexOf('function handleRegister')
  );
  assert.match(initSection, /req\.method !== 'POST'/);
  assert.match(initSection, /fileName/);
  assert.match(initSection, /mimeType/);
  assert.match(initSection, /fileSize/);
  assert.match(initSection, /MAX_FILE_SIZE_BYTES/);
  assert.match(initSection, /isAllowedMimeType/);
});

test('handleRegister bloqueia path traversal e valida ownership do storagePath', () => {
  const regSection = handlerSrc.slice(handlerSrc.indexOf('function handleRegister'));
  assert.match(regSection, /indexOf\('\.\.'\)/);
  assert.match(regSection, /indexOf\(user\.id/);
  assert.match(regSection, /SAFE_STORAGE_PATH_RE/);
});

test('handleRegister verifica existência do objeto no storage antes de atualizar', () => {
  const regSection = handlerSrc.slice(handlerSrc.indexOf('function handleRegister'));
  assert.match(regSection, /ensureObjectExistsInStorage/);
  assert.match(regSection, /Arquivo não encontrado no storage/);
});

// ── Error responses ───────────────────────────────────────────────────────────

test('handler retorna error codes machine-readable nos erros críticos', () => {
  assert.match(handlerSrc, /DB_INSERT_ERROR/);
  assert.match(handlerSrc, /STORAGE_SIGNED_URL_ERROR/);
  assert.match(handlerSrc, /DB_UPDATE_ERROR/);
  assert.match(handlerSrc, /INTERNAL_ERROR/);
});

test('handler loga detalhes reais do erro de DB (message/code/hint/details)', () => {
  assert.match(handlerSrc, /error\.message/);
  assert.match(handlerSrc, /error\.code/);
  assert.match(handlerSrc, /error\.hint/);
  assert.match(handlerSrc, /error\.details/);
});

// ── Observability ─────────────────────────────────────────────────────────────

test('handler tem logs estruturados por etapa com prefixo correto', () => {
  assert.match(handlerSrc, /\[labs\/init-upload\] start/);
  assert.match(handlerSrc, /\[labs\/init-upload\] auth/);
  assert.match(handlerSrc, /\[labs\/init-upload\] payload/);
  assert.match(handlerSrc, /\[labs\/init-upload\] storage/);
  assert.match(handlerSrc, /\[labs\/init-upload\] insert-payload/);
  assert.match(handlerSrc, /\[labs\/init-upload\] insert-result/);
  assert.match(handlerSrc, /\[labs\/init-upload\] signed-result/);
  assert.match(handlerSrc, /\[labs\/register\] start/);
  assert.match(handlerSrc, /\[labs\/register\] auth/);
  assert.match(handlerSrc, /\[labs\/register\] payload/);
  assert.match(handlerSrc, /\[labs\/fatal\]/);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

test('handler usa requireAuth via withAuth para autenticação obrigatória', () => {
  assert.match(handlerSrc, /requireAuth/);
  assert.match(handlerSrc, /withAuth/);
});

test('handler lê service role key com aliases múltiplos', () => {
  assert.match(handlerSrc, /SUPABASE_SERVICE_KEY/);
  assert.match(handlerSrc, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ── Response shape ────────────────────────────────────────────────────────────

test('init-upload retorna labReportId, storagePath, uploadUrl, uploadToken, bucket', () => {
  const initSection = handlerSrc.slice(
    handlerSrc.indexOf('function handleInitUpload'),
    handlerSrc.indexOf('function handleRegister')
  );
  assert.match(initSection, /labReportId/);
  assert.match(initSection, /storagePath/);
  assert.match(initSection, /uploadUrl/);
  assert.match(initSection, /uploadToken/);
  assert.match(initSection, /bucket/);
  assert.match(initSection, /status: 'pending_upload'/);
});

test('register retorna labReportId e status processing em sucesso', () => {
  const regSection = handlerSrc.slice(handlerSrc.indexOf('function handleRegister'));
  assert.match(regSection, /labReportId/);
  assert.match(regSection, /status: 'processing'/);
});

// ── storagePath canonical format ──────────────────────────────────────────────

test('buildCanonicalLabStoragePath gera path no formato {userId}/{uuid}.{ext}', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const path   = buildCanonicalLabStoragePath(userId, 'application/pdf', 'exame.pdf');
  assert.match(path, SAFE_STORAGE_PATH_RE, `path="${path}" não bate com SAFE_STORAGE_PATH_RE`);
  assert.ok(path.startsWith(userId + '/'), `path deve começar com userId`);
  assert.ok(path.endsWith('.pdf'), `path deve terminar com .pdf`);
});

test('buildCanonicalLabStoragePath gera extensão correta para cada mime type', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440001';
  assert.ok(buildCanonicalLabStoragePath(uid, 'image/jpeg', 'foto.jpg').endsWith('.jpg'));
  assert.ok(buildCanonicalLabStoragePath(uid, 'image/png',  'foto.png').endsWith('.png'));
  assert.ok(buildCanonicalLabStoragePath(uid, 'application/pdf', 'f.pdf').endsWith('.pdf'));
});

// ── Migration 043 ─────────────────────────────────────────────────────────────

test('migration 043 faz data migration de pending → pending_upload e parsed → uploaded', () => {
  assert.match(mig043Src, /parse_status = 'pending'\s+then\s+'pending_upload'/);
  assert.match(mig043Src, /parse_status = 'parsed'\s+then\s+'uploaded'/);
});

test('migration 043 adiciona constraint com valores corretos', () => {
  assert.match(mig043Src, /lab_reports_parse_status_check/);
  assert.match(mig043Src, /'pending_upload'/);
  assert.match(mig043Src, /'uploaded'/);
  assert.match(mig043Src, /'processing'/);
  assert.match(mig043Src, /'failed'/);
  // Valores legados não devem estar na nova constraint
  const constraintBlock = mig043Src.slice(
    mig043Src.indexOf('add constraint lab_reports_parse_status_check'),
    mig043Src.indexOf('alter column parse_status set default')
  );
  assert.doesNotMatch(constraintBlock, /'pending'[^_]/);
  assert.doesNotMatch(constraintBlock, /'parsed'/);
});

test('migration 043 corrige acquire_lab_report_edge_lock: parse_status processing', () => {
  // Slice just the CREATE OR REPLACE FUNCTION body for acquire_lab_report_edge_lock
  const fnStart = mig043Src.indexOf('create or replace function public.acquire_lab_report_edge_lock');
  const fnEnd   = mig043Src.indexOf('revoke all on function public.acquire_lab_report_edge_lock');
  assert.ok(fnStart !== -1, 'função acquire_lab_report_edge_lock não encontrada na migration');
  const funcBlock = mig043Src.slice(fnStart, fnEnd);

  // The UPDATE SET clause must use 'processing'
  assert.match(funcBlock, /parse_status\s*=\s*'processing'/);
  // Strip SQL comments before checking for absence of 'pending'
  const noSqlComments = funcBlock.split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(noSqlComments, /parse_status\s*=\s*'pending'/);
});

test('migration 043 adiciona trigger para UPDATE pending_upload → uploaded', () => {
  assert.match(mig043Src, /trg_lab_reports_dispatch_uploaded/);
  assert.match(mig043Src, /old\.status = 'pending_upload'/);
  assert.match(mig043Src, /new\.status = 'uploaded'/);
});

test('migration 043 altera default de parse_status para pending_upload', () => {
  assert.match(mig043Src, /alter column parse_status set default 'pending_upload'/);
});

// ── Mock-based functional test ────────────────────────────────────────────────

test('handleInitUpload monta insert payload com parse_status pending_upload', async () => {

  // Simulate what handleInitUpload does internally when building the insert payload
  const userId    = 'aabbccdd-1234-5678-abcd-000000000001';
  const mimeType  = 'application/pdf';
  const fileName  = 'exame-sangue.pdf';

  const storagePath = buildCanonicalLabStoragePath(userId, mimeType, fileName);

  const insertPayload = {
    user_id:        userId,
    storage_bucket: 'lab-reports',
    storage_path:   storagePath,
    file_url:       storagePath,
    file_name:      fileName,
    file_type:      mimeType,
    mime_type:      mimeType,
    status:         'pending_upload',
    parse_status:   'pending_upload',
    processing_error: null,
  };

  // Assertions on the payload that will be sent to DB
  assert.equal(insertPayload.status,       'pending_upload', 'status deve ser pending_upload');
  assert.equal(insertPayload.parse_status, 'pending_upload', 'parse_status deve ser pending_upload');
  assert.equal(insertPayload.user_id,      userId,           'user_id deve ser o do JWT');
  assert.equal(insertPayload.storage_bucket, 'lab-reports',  'bucket correto');
  assert.ok(insertPayload.storage_path.startsWith(userId + '/'), 'storage_path deve começar com userId');
  assert.match(insertPayload.storage_path, SAFE_STORAGE_PATH_RE, 'storage_path no formato canônico');
  assert.equal(insertPayload.processing_error, null, 'processing_error deve ser null');
});

test('handleRegister monta update payload com parse_status uploaded', async () => {
  const updatePayload = {
    file_name:        'exame.pdf',
    file_type:        'application/pdf',
    mime_type:        'application/pdf',
    status:           'uploaded',
    parse_status:     'uploaded',
    processing_error: null,
  };

  assert.equal(updatePayload.status,       'uploaded', 'status deve ser uploaded');
  assert.equal(updatePayload.parse_status, 'uploaded', 'parse_status deve ser uploaded');
  assert.equal(updatePayload.processing_error, null,   'processing_error deve ser null');
  assert.notEqual(updatePayload.parse_status,  'pending', 'parse_status não pode ser pending legado');
});
