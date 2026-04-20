#!/usr/bin/env bash
set -e

echo "== 1) Procurando a Edge Function lab-report-orchestrator =="
if [ -d "supabase/functions/lab-report-orchestrator" ]; then
  echo "OK: pasta da function encontrada em supabase/functions/lab-report-orchestrator"
else
  echo "ERRO: não encontrei a pasta supabase/functions/lab-report-orchestrator"
fi

echo
echo "== 2) Procurando EXAM_OCR_SERVICE_URL no projeto =="
grep -Rni "EXAM_OCR_SERVICE_URL" . || echo "ERRO: variável EXAM_OCR_SERVICE_URL não encontrada no código"

echo
echo "== 3) Conferindo uso de Deno.env.get na function =="
grep -Rni "Deno.env.get.*EXAM_OCR_SERVICE_URL" supabase/functions/lab-report-orchestrator 2>/dev/null || \
echo "ALERTA: não achei leitura de Deno.env.get('EXAM_OCR_SERVICE_URL') dentro da function"

echo
echo "== 4) Listando functions via Supabase CLI =="
if command -v supabase >/dev/null 2>&1; then
  supabase functions list || echo "ERRO: falha ao listar functions. Verifique login/link do projeto."
else
  echo "ERRO: Supabase CLI não instalado"
fi

echo
echo "== 5) Dica para conferir secrets =="
echo "No Supabase, confira em: Project Settings > Edge Functions / Secrets"
echo "A secret EXAM_OCR_SERVICE_URL precisa existir no projeto."
