import { NextRequest, NextResponse } from "next/server"
import { requireBearerAuth } from "../../_shared/requireBearerAuth"
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin"
import { logger } from "../../../../lib/utils/logger"
import { parseLabReport } from "../../../../core/labs/labParser"
import { validateLabReport } from "../../../../core/labs/labValidator"
import { applyClinicalRules, resolveDietMode } from "../../../../core/labs/labRules"
import {
  createInitialLabReport,
  finalizeLabReport,
  uploadLabReportFile,
} from "../../../../core/labs/labRepository"

export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function buildError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerAuth(req)
    if (!auth.ok) return auth.response

    const form = await req.formData().catch(() => null)
    if (!form) return buildError(400, "Payload de upload inválido.")

    const file = form.get("file")
    if (!(file instanceof File)) {
      return buildError(400, "Arquivo é obrigatório.")
    }
    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
      return buildError(413, "Arquivo inválido ou acima do limite permitido.")
    }

    const admin = createAdminSupabaseClient()
    const bytes = Buffer.from(await file.arrayBuffer())

    logger.info("labs_upload_received", {
      userId: auth.user.id,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    })

    const uploaded = await uploadLabReportFile(admin, auth.user.id, {
      name: file.name,
      type: file.type,
      bytes,
    })

    const created = await createInitialLabReport(admin, {
      userId: auth.user.id,
      fileUrl: uploaded.path,
      fileName: file.name,
      fileType: file.type,
    })

    try {
      const parsed = await parseLabReport({
        bytes,
        mimeType: file.type,
        fileName: file.name,
      })

      const validated = validateLabReport(parsed)
      const clinical = applyClinicalRules(validated.parsed)
      const mode = resolveDietMode({ is_valid: validated.isValid, parsed: validated.parsed })

      await finalizeLabReport(admin, created.id, {
        parsed: validated.parsed,
        confidence: validated.confidence,
        is_valid: validated.isValid,
        parse_status: "parsed",
        validation_errors: validated.validationErrors,
        clinical_flags: clinical.clinicalFlags,
        critical_flags: clinical.criticalFlags,
      })

      logger.info("labs_upload_parsed", {
        userId: auth.user.id,
        labReportId: created.id,
        confidence: validated.confidence,
        isValid: validated.isValid,
        mode,
        clinicalFlags: clinical.clinicalFlags,
        criticalFlags: clinical.criticalFlags,
      })

      return NextResponse.json({
        ok: true,
        uploaded: true,
        parsed: true,
        labReportId: created.id,
        isValid: validated.isValid,
        confidence: validated.confidence,
        mode,
        clinicalFlags: clinical.clinicalFlags,
      })
    } catch (parseError) {
      await finalizeLabReport(admin, created.id, {
        parse_status: "failed",
        is_valid: false,
        confidence: 0,
        validation_errors: [parseError instanceof Error ? parseError.message : "parser_failed"],
        clinical_flags: [],
        critical_flags: [],
      })

      logger.warn("labs_upload_parse_failed", {
        userId: auth.user.id,
        labReportId: created.id,
        reason: parseError instanceof Error ? parseError.message : "unknown",
      })

      return NextResponse.json({
        ok: true,
        uploaded: true,
        parsed: false,
        labReportId: created.id,
        isValid: false,
        mode: "standard",
      })
    }
  } catch (error) {
    logger.error("labs_upload_internal_error", {
      reason: error instanceof Error ? error.message : "unknown",
    })
    return buildError(500, "Não foi possível processar o exame agora.")
  }
}
