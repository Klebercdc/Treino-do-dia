/**
 * Diagnostics script for the labs upload pipeline.
 * Validates every dependency layer: envs → bucket → SDK → DB insert → rollback.
 *
 * Usage:
 *   node --env-file=.env.local scripts/check-labs-upload.mjs
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = one or more checks failed
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ── helpers ──────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function ok(label, msg)   { console.log(`  ${GREEN}✓${RESET} ${label}${msg ? ': ' + msg : ''}`); }
function fail(label, msg) { console.log(`  ${RED}✗${RESET} ${label}${msg ? ': ' + msg : ''}`); }
function warn(label, msg) { console.log(`  ${YELLOW}⚠${RESET} ${label}${msg ? ': ' + msg : ''}`); }
function info(label, msg) { console.log(`  ${CYAN}·${RESET} ${label}${msg ? ': ' + msg : ''}`); }
function heading(title)   { console.log(`\n${BOLD}${CYAN}── ${title}${RESET}`); }

const LAB_REPORTS_BUCKET = 'lab-reports';

// ── 1. Environment ────────────────────────────────────────────────────────────

heading('1. Environment variables');

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/$/, '');

const serviceKey = (
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  ''
);

let envOk = true;

if (!supabaseUrl) {
  fail('SUPABASE_URL', 'não encontrada (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL)');
  envOk = false;
} else {
  ok('SUPABASE_URL', supabaseUrl.slice(0, 40) + (supabaseUrl.length > 40 ? '…' : ''));
}

if (!serviceKey) {
  fail('SUPABASE_SERVICE_ROLE_KEY', 'não encontrada (SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY)');
  envOk = false;
} else {
  ok('SUPABASE_SERVICE_ROLE_KEY', serviceKey.slice(0, 12) + '…[redacted]');
}

if (!envOk) {
  console.log(`\n${RED}${BOLD}ABORTANDO: variáveis obrigatórias ausentes.${RESET}\n`);
  process.exit(1);
}

// ── 2. SDK instantiation ──────────────────────────────────────────────────────

heading('2. SDK instantiation');

let admin;
try {
  admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  ok('createClient', 'instância criada');
} catch (err) {
  fail('createClient', err.message);
  process.exit(1);
}

heading('2.5. Diagnostic user');

let diagnosticUserId = '';
try {
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile?.id) {
    fail('diagnostic user', profileErr?.message || 'nenhum profile disponível para teste');
    process.exit(1);
  }

  diagnosticUserId = String(profile.id);
  ok('diagnostic user', diagnosticUserId);
} catch (err) {
  fail('diagnostic user', err.message);
  process.exit(1);
}

// ── 3. createSignedUploadUrl availability ─────────────────────────────────────

heading('3. SDK: createSignedUploadUrl');

const bucketHandle = admin.storage.from(LAB_REPORTS_BUCKET);
const csuType = typeof bucketHandle.createSignedUploadUrl;
info('typeof createSignedUploadUrl', csuType);

if (csuType !== 'function') {
  fail('createSignedUploadUrl', `SDK_INCOMPATIBLE — found typeof=${csuType}, need function`);
  process.exit(1);
} else {
  ok('createSignedUploadUrl', 'disponível como function');
}

// ── 4. Bucket existence ───────────────────────────────────────────────────────

heading('4. Bucket: ' + LAB_REPORTS_BUCKET);

let bucketOk = false;
try {
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) {
    fail('listBuckets', bErr.message);
  } else {
    const found = (buckets || []).find(b => b.id === LAB_REPORTS_BUCKET || b.name === LAB_REPORTS_BUCKET);
    if (!found) {
      fail('bucket lab-reports', 'NÃO ENCONTRADO — crie via migration 036 ou dashboard');
    } else {
      bucketOk = true;
      ok('bucket lab-reports', `id=${found.id} public=${found.public} limit=${found.file_size_limit}`);
    }
  }
} catch (err) {
  fail('listBuckets', err.message);
}

// ── 5. createSignedUploadUrl call (synthetic path) ────────────────────────────

heading('5. createSignedUploadUrl (path sintético)');

const syntheticPath = `${diagnosticUserId}/${crypto.randomUUID()}.pdf`;
info('path sintético', syntheticPath);

let signedUrlOk = false;
if (bucketOk) {
  try {
    const { data: signedData, error: signedErr } = await bucketHandle.createSignedUploadUrl(syntheticPath);
    if (signedErr) {
      fail('createSignedUploadUrl', `${signedErr.message} (code=${signedErr.statusCode})`);
      info('details', JSON.stringify(signedErr).slice(0, 200));
    } else if (!signedData?.signedUrl || !signedData?.token) {
      fail('createSignedUploadUrl', 'resposta incompleta — sem signedUrl ou token');
      info('data', JSON.stringify(signedData).slice(0, 200));
    } else {
      signedUrlOk = true;
      ok('signedUrl', 'gerada com sucesso');
      ok('token', 'presente');
    }
  } catch (err) {
    fail('createSignedUploadUrl (exception)', err.message);
  }
} else {
  warn('createSignedUploadUrl', 'PULADO — bucket não encontrado');
}

// ── 6. DB insert with parse_status='pending_upload' ───────────────────────────

heading('6. DB insert em public.lab_reports (parse_status=pending_upload)');

const testStoragePath = `${diagnosticUserId}/${crypto.randomUUID()}.pdf`;
let insertedId = null;

try {
  const insertPayload = {
    user_id:        diagnosticUserId,
    storage_bucket: LAB_REPORTS_BUCKET,
    storage_path:   testStoragePath,
    file_url:       testStoragePath,
    file_name:      'check-labs-diagnostics.pdf',
    file_type:      'application/pdf',
    mime_type:      'application/pdf',
    status:         'pending_upload',
    parse_status:   'pending_upload',
    processing_error: null,
  };
  info('insert payload', `status=${insertPayload.status} parse_status=${insertPayload.parse_status}`);

  const { data: created, error: dbErr } = await admin
    .from('lab_reports')
    .insert(insertPayload)
    .select('id,status,parse_status')
    .single();

  if (dbErr) {
    fail('INSERT lab_reports', `${dbErr.message} | code=${dbErr.code} | details=${dbErr.details} | hint=${dbErr.hint}`);
    if (dbErr.code === '23514') {
      fail('→ CONSTRAINT VIOLATION', 'A migration 043 provavelmente não foi aplicada no banco.');
    }
  } else if (!created?.id) {
    fail('INSERT lab_reports', 'sem id retornado');
  } else {
    insertedId = created.id;
    ok('INSERT lab_reports', `id=${insertedId} status=${created.status} parse_status=${created.parse_status}`);
  }
} catch (err) {
  fail('INSERT lab_reports (exception)', err.message);
}

// ── 7. Rollback ───────────────────────────────────────────────────────────────

heading('7. Rollback do registro de teste');

if (insertedId) {
  try {
    const { error: delErr } = await admin
      .from('lab_reports')
      .delete()
      .eq('id', insertedId);

    if (delErr) {
      warn('DELETE lab_reports', `${delErr.message} — limpe manualmente: id=${insertedId}`);
    } else {
      ok('DELETE lab_reports', `id=${insertedId} removido`);
    }
  } catch (err) {
    warn('DELETE lab_reports (exception)', err.message + ` — limpe manualmente: id=${insertedId}`);
  }
} else {
  info('DELETE', 'nada a remover (insert falhou)');
}

// ── 8. parse_status constraint validation ─────────────────────────────────────

heading('8. Validação: parse_status constraint rejeita valor legado');

try {
  const { error: badInsErr } = await admin
    .from('lab_reports')
    .insert({
      user_id:      diagnosticUserId,
      file_url:     `${diagnosticUserId}/${crypto.randomUUID()}.pdf`,
      status:       'pending_upload',
      parse_status: 'pending',   // valor legado — deve ser rejeitado
    });

  if (badInsErr && badInsErr.code === '23514') {
    ok('constraint rejeita pending', 'migration 043 aplicada — constraint funcionando');
  } else if (badInsErr) {
    warn('insert com pending', `erro inesperado: ${badInsErr.message} (code=${badInsErr.code})`);
  } else {
    fail('constraint NÃO rejeita pending', 'migration 043 NÃO foi aplicada — o banco ainda aceita o valor legado!');
  }
} catch (err) {
  warn('validação constraint (exception)', err.message);
}

// ── Summary ───────────────────────────────────────────────────────────────────

heading('Resumo');

const allCriticalPassed = envOk && signedUrlOk && insertedId !== null;

if (allCriticalPassed) {
  console.log(`\n${GREEN}${BOLD}✓ TODAS as verificações críticas passaram.${RESET}`);
  console.log(`${GREEN}  O pipeline de upload de exames está operacional.${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${RED}${BOLD}✗ Uma ou mais verificações falharam.${RESET}`);
  console.log(`${RED}  Verifique os itens marcados com ✗ acima.${RESET}`);
  console.log(`\n${YELLOW}Ação recomendada:${RESET}`);
  if (!envOk)       console.log('  • Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  if (!bucketOk)    console.log('  • Aplique migration 036 para criar o bucket lab-reports');
  if (!signedUrlOk) console.log('  • Verifique policies do bucket e versão do SDK (@supabase/supabase-js >=2.x)');
  if (!insertedId)  console.log('  • Aplique migration 043 para corrigir o constraint de parse_status');
  console.log('');
  process.exit(1);
}
