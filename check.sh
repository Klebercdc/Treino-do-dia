#!/usr/bin/env bash
set -e

echo "===== CHECK OCR PIPELINE ====="

echo
echo "1) Function existe localmente?"
if [ -d "supabase/functions/lab-report-orchestrator" ]; then
  echo "OK: Function encontrada"
else
  echo "ERRO: Function NÃO encontrada"
fi

echo
echo "2) Variável EXAM_OCR_SERVICE_URL no código?"
grep -Rni "EXAM_OCR_SERVICE_URL" . || echo "ERRO: variável não encontrada no projeto"

echo
echo "3) Está usando Deno.env.get?"
grep -Rni "Deno.env.get.*EXAM_OCR_SERVICE_URL" supabase/functions/lab-report-orchestrator 2>/dev/null || \
echo "ALERTA: não está lendo a env var corretamente"

echo
echo "4) Supabase CLI disponível?"
if command -v supabase >/dev/null 2>&1; then
  echo "OK: CLI instalada"

  echo
  echo "5) Functions deployadas:"
  supabase functions list || echo "ERRO ao listar functions"
else
  echo "ERRO: Supabase CLI não instalada"
fi

echo
echo "===== FIM DO CHECK ====="
