import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

type Status = 'OK' | 'FALHA' | 'BLOQUEIO';

type CheckResult = {
  name: string;
  status: Status;
  summary: string;
  details?: Record<string, unknown>;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://kronia.app.br').replace(/\/$/, '');
const TARGET_LAB_REPORT_ID = process.env.LAB_REPORT_ID || '4cfad5b1-b189-4fa4-8b6f-371c26de9005';

const results: CheckResult[] = [];

function add(result: CheckResult) {
  results.push(result);
  console.log(`[${result.status}] ${result.name}: ${result.summary}`);
  if (result.details) {
    console.log(JSON.stringify(result.details, null, 2));
  }
}

function isMissingOptionalTable(error: { code?: string | null; message?: string | null } | null | undefined, table: string) {
  return error?.code === 'PGRST205' && new RegExp(`table ['"]?public\\.${table}['"]?`, 'i').test(String(error.message || ''));
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    add({
      name: 'env_runtime',
      status: 'BLOQUEIO',
      summary: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes para checagem remota.',
    });
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  add({
    name: 'repo_routes',
    status: existsSync('vercel.json') && /kronia-labs-init-upload/.test(readFileSync('vercel.json', 'utf8')) ? 'OK' : 'FALHA',
    summary: 'Rewrites de labs em vercel.json verificados.',
  });

  const ocrFilesOk = [
    'api/exam_ocr.py',
    'services/exam_ocr/service.py',
    'requirements.txt',
  ].every((file) => existsSync(file));
  add({
    name: 'repo_ocr_assets',
    status: ocrFilesOk ? 'OK' : 'FALHA',
    summary: ocrFilesOk ? 'Endpoint OCR publicável presente no repositório.' : 'Arquivos necessários do OCR não estão completos no repositório.',
  });

  const report = await supabase
    .from('lab_reports')
    .select('id,status,parse_status,storage_bucket,storage_path,mime_type,extraction_mode,source_type,normalized_payload,confidence_summary,ai_insights,processing_error,processed_at,last_dispatch_source,last_dispatch_at,last_orchestrator_note,processing_attempts')
    .eq('id', TARGET_LAB_REPORT_ID)
    .maybeSingle();
  add({
    name: 'db_lab_report_target',
    status: report.error ? 'FALHA' : report.data ? 'OK' : 'FALHA',
    summary: report.error
      ? `Falha ao ler exame alvo: ${report.error.message}`
      : report.data
        ? `Exame alvo encontrado em status=${report.data.status} parse_status=${report.data.parse_status}`
        : 'Exame alvo não encontrado.',
    details: report.data || undefined,
  });

  const events = await supabase
    .from('lab_report_pipeline_events')
    .select('event_type,level,created_at')
    .eq('lab_report_id', TARGET_LAB_REPORT_ID)
    .order('created_at', { ascending: false })
    .limit(10);
  add({
    name: 'db_pipeline_events',
    status: events.error ? 'FALHA' : 'OK',
    summary: events.error ? `Falha ao ler pipeline events: ${events.error.message}` : `Tabela de eventos acessível (${(events.data || []).length} eventos recentes).`,
  });

  for (const table of ['lab_report_extractions', 'lab_report_biomarkers']) {
    const result = await supabase.from(table).select('*').limit(1);
    const missingOptionalTable = isMissingOptionalTable(result.error, table);
    add({
      name: `db_${table}`,
      status: result.error ? (missingOptionalTable ? 'OK' : 'FALHA') : 'OK',
      summary: result.error
        ? (missingOptionalTable
            ? 'Tabela auxiliar ausente no schema; fallback em normalized_payload deve cobrir produção.'
            : result.error.message)
        : 'Tabela acessível.',
      details: result.error ? { code: result.error.code, hint: result.error.hint } : undefined,
    });
  }

  const rpcLock = await supabase.rpc('acquire_lab_report_edge_lock', {
    p_lab_report_id: TARGET_LAB_REPORT_ID,
    p_expected_updated_at: null,
    p_source: 'labs_pipeline_check_readonly',
  });
  add({
    name: 'db_rpc_acquire_lock',
    status: rpcLock.error ? 'FALHA' : 'OK',
    summary: rpcLock.error ? `RPC acquire_lab_report_edge_lock indisponível: ${rpcLock.error.message}` : 'RPC acquire_lab_report_edge_lock acessível.',
  });

  const liveLabsRoute = await fetch(`${APP_URL}/api/kronia/labs/reports`, {
    headers: { authorization: 'Bearer invalid' },
  }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) } as Response));
  add({
    name: 'live_web_labs_route',
    status: liveLabsRoute.status === 401 ? 'OK' : 'FALHA',
    summary: `Rota protegida respondeu HTTP ${liveLabsRoute.status}.`,
  });

  const liveOcr = await fetch(`${APP_URL}/api/exam_ocr`).catch(() => null);
  add({
    name: 'live_ocr_route',
    status: liveOcr?.ok ? 'OK' : 'FALHA',
    summary: liveOcr?.ok ? 'OCR HTTP respondeu /api/exam_ocr.' : 'OCR HTTP ainda não está disponível na app pública.',
  });

  if (!SUPABASE_ANON_KEY) {
    add({
      name: 'live_edge_function',
      status: 'BLOQUEIO',
      summary: 'NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY ausente para validar a edge function por HTTP.',
    });
  } else {
    const edge = await fetch(`${SUPABASE_URL}/functions/v1/lab-report-orchestrator`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    }).catch(() => null);
    add({
      name: 'live_edge_function',
      status: edge && (edge.status === 400 || edge.ok) ? 'OK' : 'FALHA',
      summary: edge ? `Edge function respondeu HTTP ${edge.status}.` : 'Não foi possível alcançar a edge function.',
    });
  }

  const overall = results.some((item) => item.status === 'FALHA')
    ? 'FALHA'
    : results.some((item) => item.status === 'BLOQUEIO')
      ? 'BLOQUEIO'
      : 'OK';
  console.log(`\nSTATUS GERAL: ${overall}`);
  process.exit(overall === 'FALHA' ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
