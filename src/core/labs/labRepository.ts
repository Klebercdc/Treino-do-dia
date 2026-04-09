import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { StoredLabContext } from "./labTypes"

export const LAB_REPORTS_BUCKET = "lab-reports"
const NORMALIZED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"])
const MIME_ALIASES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
  "image/x-png": "image/png",
}
const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
}

function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "lab-report"
}

function getExtension(filename: string): string {
  const safe = sanitizeFilename(filename).toLowerCase()
  const dotIndex = safe.lastIndexOf(".")
  return dotIndex >= 0 ? safe.slice(dotIndex) : ""
}

function getExtensionFromMimeOrName(mimeType: string, filename: string): string {
  const normalizedMime = String(mimeType || "").toLowerCase()
  const extFromName = getExtension(filename)

  if (normalizedMime === "application/pdf" || extFromName === ".pdf") return ".pdf"
  if (normalizedMime === "image/png" || extFromName === ".png") return ".png"
  return ".jpg"
}

export function resolveAllowedLabMimeType(input: { mimeType?: string | null; filename?: string | null }): string {
  const rawMimeType = String(input.mimeType || "").trim().toLowerCase()
  const normalizedFromMime = MIME_ALIASES[rawMimeType]
  if (normalizedFromMime && NORMALIZED_MIME_TYPES.has(normalizedFromMime)) {
    return normalizedFromMime
  }

  const fromExtension = EXTENSION_TO_MIME[getExtension(String(input.filename || ""))]
  if (fromExtension && NORMALIZED_MIME_TYPES.has(fromExtension)) {
    return fromExtension
  }

  throw new Error("Tipo de arquivo inválido. Envie PDF, JPG ou PNG.")
}

export function assertAllowedLabMimeType(mimeType: string, filename?: string): string {
  return resolveAllowedLabMimeType({ mimeType, filename })
}

export function buildLabReportStoragePath(
  userId: string,
  input: { filename?: string | null; mimeType?: string | null } | string,
  mimeTypeFromLegacyArg?: string,
): string {
  const filename = typeof input === "string" ? input : String(input?.filename || "")
  const mimeType = typeof input === "string" ? String(mimeTypeFromLegacyArg || "") : String(input?.mimeType || "")
  const ext = getExtensionFromMimeOrName(mimeType, filename)
  return `${userId}/${randomUUID()}${ext}`
}

export async function uploadLabReportFile(
  admin: SupabaseClient,
  userId: string,
  file: { name: string; type: string; bytes: Buffer },
): Promise<{ path: string }> {
  const normalizedMimeType = assertAllowedLabMimeType(file.type, file.name)
  const path = buildLabReportStoragePath(userId, { filename: file.name, mimeType: normalizedMimeType })
  const { error } = await admin.storage.from(LAB_REPORTS_BUCKET).upload(path, file.bytes, {
    contentType: normalizedMimeType,
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
      status: "uploaded",
      confidence: 0,
      confidence_summary: {},
      storage_bucket: LAB_REPORTS_BUCKET,
      storage_path: input.fileUrl,
      mime_type: input.fileType,
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
