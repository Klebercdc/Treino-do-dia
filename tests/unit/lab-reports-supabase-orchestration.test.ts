import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('migration 039 adiciona pg_net, pg_cron, vault e trigger de dispatch', () => {
  const source = readFileSync('supabase/migrations/039_lab_reports_supabase_orchestration.sql', 'utf-8');
  assert.match(source, /create extension if not exists pg_net/i);
  assert.match(source, /create extension if not exists pg_cron/i);
  assert.match(source, /create extension if not exists vault/i);
  assert.match(source, /dispatch_lab_report_to_edge/i);
  assert.match(source, /handle_lab_report_dispatch_trigger/i);
  assert.match(source, /trg_lab_reports_dispatch_insert/i);
  assert.match(source, /cron\.schedule\(/i);
  assert.match(source, /lab-report-orchestrator\/watchdog/i);
});

test('Edge Function de exames usa Groq server-side e OCR separado', () => {
  const source = readFileSync('supabase/functions/lab-report-orchestrator/index.ts', 'utf-8');
  assert.match(source, /GROQ_API_KEY/);
  assert.match(source, /EXAM_OCR_SERVICE_URL/);
  assert.match(source, /callGroqInsights/);
  assert.match(source, /callOcr/);
  assert.match(source, /buildRuleBasedFallback/);
  assert.match(source, /structured_biomarkers/);
});

test('Edge Function processa watchdog sem OCR inline no SQL cron', () => {
  const source = readFileSync('supabase/functions/lab-report-orchestrator/index.ts', 'utf-8');
  assert.match(source, /dispatchWatchdog/);
  assert.match(source, /watchdog_dispatched/);
  assert.match(source, /fetch\(baseUrl/);
});

test('observabilidade do pipeline fica persistida em tabela dedicada', () => {
  const source = readFileSync('supabase/migrations/039_lab_reports_supabase_orchestration.sql', 'utf-8');
  assert.match(source, /lab_report_pipeline_events/);
  assert.match(source, /log_lab_report_pipeline_event/);
  assert.match(source, /dispatch_enqueued/);
  assert.match(source, /dispatch_failed/);
});
