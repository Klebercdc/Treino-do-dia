#!/usr/bin/env node
/**
 * Backfill idempotente da coluna lab_reports.exam_date.
 *
 * Contexto: a coluna exam_date foi adicionada em 06/2026. Exames processados
 * antes disso (ou cujo serviço OCR não extraiu a data) ficaram com exam_date NULL.
 * A pipeline nova (lab-report-orchestrator) já grava exam_date quando o OCR
 * retorna ocr.exam_date — este script cobre apenas o histórico legado.
 *
 * REGRA CLÍNICA: nunca inventar data. Só preenche quando encontra uma data de
 * COLETA inequívoca no raw_text. Layouts ambíguos (ex.: UNIMED, que agrupa os
 * rótulos antes dos valores e faz a data de nascimento aparecer logo após
 * "Data Entrada") são deixados como NULL e listados para revisão manual.
 *
 * Idempotente: só toca linhas com exam_date IS NULL.
 *
 * Uso:
 *   node scripts/backfill-lab-exam-date.mjs            # dry-run (apenas mostra)
 *   node scripts/backfill-lab-exam-date.mjs --apply    # grava no banco
 *
 * Requer no ambiente:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('[backfill] faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

/** Converte "DD/MM/YYYY" em "YYYY-MM-DD"; retorna null se inválida/implausível. */
function brToIso(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const day = Number(dd), month = Number(mm), year = Number(yyyy)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (year < 2000 || year > new Date().getFullYear() + 1) return null
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Extrai a data de coleta de forma CONSERVADORA.
 * Estratégia única confiável entre layouts: rótulo "Coleta" seguido, em até
 * ~40 caracteres (tolerando quebras de linha do OCR), de uma data DD/MM/YYYY.
 * Qualquer outra heurística (Data Entrada, Emissão) é evitada por risco de
 * capturar nascimento/assinatura/saída.
 */
function extractExamDate(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const re = /Coleta[^0-9]{0,40}?(\d{2}\/\d{2}\/\d{4})/gi
  const found = new Set()
  let m
  while ((m = re.exec(rawText)) !== null) {
    const iso = brToIso(m[1])
    if (iso) found.add(iso)
  }
  // Só aceita quando há exatamente UMA data de coleta candidata (sem ambiguidade).
  return found.size === 1 ? [...found][0] : null
}

/** Lê data já estruturada no payload, se houver (prioritário ao raw_text). */
function structuredDate(np) {
  if (!np || typeof np !== 'object') return null
  const candidates = [
    np.exam_date, np.collection_date, np.collected_at,
    np.sample_collected_at, np.report_date,
    np.extraction?.metadata?.collection_date,
    np.extraction?.metadata?.exam_date,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const iso = /^\d{4}-\d{2}-\d{2}/.test(c) ? c.slice(0, 10) : brToIso(c.trim())
      if (iso) return iso
    }
  }
  return null
}

async function main() {
  const { data, error } = await admin
    .from('lab_reports')
    .select('id, file_name, created_at, normalized_payload')
    .is('exam_date', null)

  if (error) {
    console.error('[backfill] erro ao buscar lab_reports:', error.message)
    process.exit(1)
  }

  const rows = data || []
  console.log(`[backfill] ${rows.length} exame(s) com exam_date NULL.\n`)

  const toUpdate = []
  const manual = []

  for (const row of rows) {
    const np = row.normalized_payload
    const raw = np?.extraction?.raw_text || null
    const date = structuredDate(np) || extractExamDate(raw)
    if (date) {
      toUpdate.push({ id: row.id, file: row.file_name, date })
    } else {
      manual.push({ id: row.id, file: row.file_name })
    }
  }

  console.log('=== Resolvidos automaticamente (Coleta inequívoca) ===')
  toUpdate.forEach(r => console.log(`  ${r.id}  ${r.date}  ${r.file || ''}`))
  console.log('\n=== Sem data confiável (mantidos NULL — revisão manual) ===')
  manual.forEach(r => console.log(`  ${r.id}  ${r.file || ''}`))

  if (!APPLY) {
    console.log('\n[dry-run] nada gravado. Use --apply para persistir.')
    return
  }

  let ok = 0
  for (const r of toUpdate) {
    const { error: upErr } = await admin
      .from('lab_reports')
      .update({ exam_date: r.date })
      .eq('id', r.id)
      .is('exam_date', null) // idempotência: não sobrescreve valor já existente
    if (upErr) console.error(`  FALHA ${r.id}: ${upErr.message}`)
    else ok++
  }
  console.log(`\n[backfill] ${ok}/${toUpdate.length} atualizado(s).`)
}

main().catch(err => { console.error(err); process.exit(1) })
