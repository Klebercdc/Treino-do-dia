/**
 * GET /api/kronia/labs/reports
 *
 * Lista o histórico de exames laboratoriais do usuário autenticado.
 * Retorna os N mais recentes com status, biomarcadores e flags clínicas.
 *
 * Query params:
 *   limit  → número de resultados (padrão: 10, máx: 50)
 *   valid  → "true" para retornar apenas exames com is_valid=true
 */

import { NextRequest, NextResponse } from "next/server"
import { requireBearerAuth } from "../../../_shared/requireBearerAuth"
import { createAdminSupabaseClient } from "../../../../../lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req)
    if (!auth.ok) return auth.response as Response

    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get("limit") || "10"), 50)
    const onlyValid = searchParams.get("valid") === "true"

    const admin = createAdminSupabaseClient()

    let query = admin
      .from("lab_reports")
      .select(
        "id, file_name, file_type, parse_status, parsed, confidence, is_valid, clinical_flags, critical_flags, validation_errors, created_at",
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (onlyValid) {
      query = query.eq("is_valid", true)
    }

    const { data, error } = await query

    if (error) {
      console.error("[labs-reports-route] query error:", error)
      return NextResponse.json({ ok: false, error: "Erro ao buscar histórico de exames." }, { status: 500 })
    }

    const reports = (data || []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      fileType: row.file_type,
      parseStatus: row.parse_status,
      parsed: row.parsed,
      confidence: row.confidence,
      isValid: row.is_valid,
      clinicalFlags: Array.isArray(row.clinical_flags) ? row.clinical_flags : [],
      criticalFlags: Array.isArray(row.critical_flags) ? row.critical_flags : [],
      validationErrors: Array.isArray(row.validation_errors) ? row.validation_errors : [],
      createdAt: row.created_at,
    }))

    return NextResponse.json({ ok: true, reports, total: reports.length })
  } catch (error) {
    console.error("[labs-reports-route] internal error:", error)
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 })
  }
}
