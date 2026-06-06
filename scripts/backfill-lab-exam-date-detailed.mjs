#!/usr/bin/env node
/**
 * Backfill detalhado de lab_reports.exam_date.
 *
 * Mesmo comportamento do backfill-lab-exam-date.mjs, com saída
 * verbose: trecho do raw_text que gerou a data, candidatos encontrados,
 * fonte da resolução e resumo final.
 *
 * Uso:
 *   node scripts/backfill-lab-exam-date-detailed.mjs           # dry-run
 *   node scripts/backfill-lab-exam-date-detailed.mjs --apply   # grava
 *
 * Requer: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const APPLY  = process.argv.includes('--apply')
const URL_   = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_ || !KEY) {
  console.error('[backfill] faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(URL_, KEY, { auth: { persistSession: false } })

// ─── helpers de data ──────────────────────────────────────────────────────────

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
 * Tenta extrair data de coleta a partir de campos estruturados do payload.
 * Retorna { date, field } ou null.
 */
function structuredDate(np) {
  if (!np || typeof np !== 'object') return null
  const fields = [
    ['exam_date',                              np.exam_date],
    ['collection_date',                        np.collection_date],
    ['collected_at',                           np.collected_at],
    ['sample_collected_at',                    np.sample_collected_at],
    ['report_date',                            np.report_date],
    ['extraction.metadata.collection_date',    np.extraction?.metadata?.collection_date],
    ['extraction.metadata.exam_date',          np.extraction?.metadata?.exam_date],
  ]
  for (const [field, val] of fields) {
    if (typeof val === 'string' && val.trim()) {
      const iso = /^\d{4}-\d{2}-\d{2}/.test(val)
        ? val.slice(0, 10)
        : brToIso(val.trim())
      if (iso) return { date: iso, field }
    }
  }
  return null
}

/**
 * Extrai data de coleta do raw_text de forma conservadora.
 * Retorna { date, candidates, snippets } ou null.
 * candidates: todas as datas encontradas (Set antes de dedup)
 * snippets:   trechos do texto que geraram cada candidato
 */
function extractFromRawText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null

  const re = /(?:Data\s+d[ae]\s+[Cc]oleta|Data\s+do\s+[Ee]xame|[Rr]ealizado\s+em|[Cc]oleta)[^0-9]{0,50}?(\d{2}\/\d{2}\/\d{4})/gi
  const candidates = new Map() // iso → snippet
  let m

  while ((m = re.exec(rawText)) !== null) {
    const iso = brToIso(m[1])
    if (!iso) continue
    if (!candidates.has(iso)) {
      const start = Math.max(0, m.index - 10)
      const end   = Math.min(rawText.length, m.index + m[0].length + 10)
      const snippet = rawText.slice(start, end).replace(/\s+/g, ' ').trim()
      candidates.set(iso, snippet)
    }
  }

  if (candidates.size === 0) return null

  const date = candidates.size === 1 ? [...candidates.keys()][0] : null
  return { date, candidates }
}

// ─── formatação ──────────────────────────────────────────────────────────────

const SEP   = '─'.repeat(60)
const SEP2  = '═'.repeat(60)
const TICK  = '✓'
const CROSS = '✗'
const WARN  = '⚠'

function fmt(label, value) {
  return `  ${label.padEnd(12)} ${value}`
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[backfill] ${APPLY ? 'MODO APPLY — gravando no banco' : 'dry-run — nenhuma escrita'}`)
  console.log('[backfill] buscando lab_reports com exam_date NULL...\n')

  const { data, error } = await admin
    .from('lab_reports')
    .select('id, file_name, created_at, normalized_payload')
    .is('exam_date', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[backfill] erro ao buscar:', error.message)
    process.exit(1)
  }

  const rows = data || []
  console.log(`[backfill] ${rows.length} exame(s) com exam_date NULL.\n`)

  if (rows.length === 0) {
    console.log('[backfill] nenhum registro para processar.')
    return
  }

  const resolved = []  // { id, file, date, source, detail }
  const manual   = []  // { id, file, reason }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const np  = row.normalized_payload
    const raw = np?.extraction?.raw_text || null

    console.log(SEP)
    console.log(`EXAME ${i + 1}/${rows.length}`)
    console.log(fmt('id:',       row.id))
    console.log(fmt('arquivo:',  row.file_name || '(sem nome)'))
    console.log(fmt('criado em:', row.created_at?.slice(0, 19).replace('T', ' ') || '?'))
    console.log()

    // 1) tenta payload estruturado
    const sp = structuredDate(np)
    if (sp) {
      console.log(`  [payload]  data encontrada em campo "${sp.field}": ${sp.date}`)
      console.log(`  → ${TICK} ACEITA: exam_date = ${sp.date}  (fonte: structured_payload)`)
      resolved.push({ id: row.id, file: row.file_name, date: sp.date, source: 'structured_payload', detail: sp.field })
      console.log()
      continue
    }

    console.log('  [payload]  sem data estruturada no normalized_payload')

    // 2) tenta raw_text
    if (!raw) {
      console.log('  [raw_text] raw_text ausente ou vazio')
      console.log(`  → ${WARN} MANTÉM NULL (revisão manual — sem raw_text)`)
      manual.push({ id: row.id, file: row.file_name, reason: 'raw_text ausente' })
      console.log()
      continue
    }

    console.log(`  [raw_text] ${raw.length} caracteres`)
    const rx = extractFromRawText(raw)

    if (!rx) {
      console.log('  [raw_text] nenhum rótulo de coleta encontrado')
      console.log(`  → ${WARN} MANTÉM NULL (revisão manual — sem rótulo de coleta)`)
      manual.push({ id: row.id, file: row.file_name, reason: 'nenhum rótulo de coleta encontrado' })
      console.log()
      continue
    }

    // mostra candidatos encontrados
    console.log(`  [raw_text] ${rx.candidates.size} data(s) candidata(s):`)
    for (const [iso, snippet] of rx.candidates) {
      console.log(`             ${iso}  ← "${snippet}"`)
    }

    if (rx.date) {
      console.log(`  → ${TICK} ACEITA: exam_date = ${rx.date}  (fonte: raw_text, rótulo inequívoco)`)
      resolved.push({ id: row.id, file: row.file_name, date: rx.date, source: 'raw_text', detail: [...rx.candidates.values()][0] })
    } else {
      console.log(`  → ${WARN} MANTÉM NULL (datas distintas — ambíguo, revisão manual)`)
      manual.push({ id: row.id, file: row.file_name, reason: `${rx.candidates.size} datas distintas: ${[...rx.candidates.keys()].join(', ')}` })
    }
    console.log()
  }

  // ─── resumo ──────────────────────────────────────────────────────────────
  console.log(SEP2)
  console.log('RESUMO')
  console.log(fmt('Total NULL:',    String(rows.length)))
  console.log(fmt('Resolvidos:',    String(resolved.length)))
  console.log(fmt('Rev. manual:',   String(manual.length)))
  console.log()

  if (resolved.length) {
    console.log('  Resolvidos automaticamente:')
    resolved.forEach(r => console.log(`    ${r.id}  ${r.date}  [${r.source}]  ${r.file || ''}`))
    console.log()
  }

  if (manual.length) {
    console.log('  Revisão manual necessária (mantidos NULL):')
    manual.forEach(r => console.log(`    ${r.id}  ${r.file || ''}  — ${r.reason}`))
    console.log()
  }

  if (!APPLY) {
    console.log('[dry-run] nada gravado. Execute com --apply para persistir.')
    return
  }

  // ─── apply ───────────────────────────────────────────────────────────────
  console.log('[apply] iniciando atualizações...')
  let ok = 0, fail = 0

  for (const r of resolved) {
    const { error: upErr } = await admin
      .from('lab_reports')
      .update({ exam_date: r.date })
      .eq('id', r.id)
      .is('exam_date', null) // idempotência: não sobrescreve valor já existente
    if (upErr) {
      console.error(`  ${CROSS} FALHA  ${r.id}: ${upErr.message}`)
      fail++
    } else {
      console.log(`  ${TICK} OK     ${r.id}  exam_date = ${r.date}`)
      ok++
    }
  }

  console.log()
  console.log(`[apply] concluído: ${ok} atualizado(s), ${fail} falha(s).`)
  if (manual.length) {
    console.log(`[apply] ${manual.length} exame(s) mantido(s) NULL — verifique manualmente.`)
  }
}

main().catch(err => { console.error('[backfill] erro inesperado:', err); process.exit(1) })
