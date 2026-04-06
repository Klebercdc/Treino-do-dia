import type { SupabaseClient } from "@supabase/supabase-js"
import type { StoredLabContext } from "./labTypes"

export const LAB_REPORTS_BUCKET = "lab-reports"
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])

function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "lab-report"
}

export function assertAllowedLabMimeType(mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Tipo de arquivo inválido. Envie PDF, JPG ou PNG.")
  }
}

export function buildLabReportStoragePath(userId: string, filename: string): string {
  const safeName = sanitizeFilename(filename)
  return `${userId}/${Date.now()}-${safeName}`
}

export async function uploadLabReportFile(
  admin: SupabaseClient,
  userId: string,
  file: { name: string; type: string; bytes: Buffer },
): Promise<{ path: string }> {
  assertAllowedLabMimeType(file.type)
  const path = buildLabReportStoragePath(userId, file.name)
  const { error } = await admin.storage.from(LAB_REPORTS_BUCKET).upload(path, file.bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Falha ao enviar exame para storage: ${error.message}`)
  return { path }
}

export async function createInitialLabReport(
  admin: SupabaseClient,
  input: { userId: string; fileUrl: string; fileName: string; fileType: string },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("lab_reports")
    .insert({
      user_id: input.userId,
      file_url: input.fileUrl,
      file_name: input.fileName,
      file_type: input.fileType,
      parse_status: "pending",
      confidence: 0,
      is_valid: false,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(`Falha ao criar registro do exame: ${error?.message || "unknown"}`)
  }

  return { id: data.id as string }
}

export async function finalizeLabReport(
  admin: SupabaseClient,
  reportId: string,
  update: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("lab_reports").update(update).eq("id", reportId)
  if (error) throw new Error(`Falha ao atualizar exame: ${error.message}`)
}

export async function getLatestValidLabReport(
  admin: SupabaseClient,
  userId: string,
): Promise<StoredLabContext | null> {
  const { data, error } = await admin
    .from("lab_reports")
    .select("id, parsed, confidence, is_valid, clinical_flags, critical_flags, created_at")
    .eq("user_id", userId)
    .eq("is_valid", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: String(data.id),
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    confidence: Number(data.confidence || 0),
    mode: "clinical",
    parsed: (data.parsed as StoredLabContext["parsed"]) || null,
    isValid: Boolean(data.is_valid),
    clinicalFlags: Array.isArray(data.clinical_flags) ? data.clinical_flags.map((item) => String(item)) : [],
    criticalFlags: Array.isArray(data.critical_flags) ? data.critical_flags.map((item) => String(item)) : [],
  }
}
