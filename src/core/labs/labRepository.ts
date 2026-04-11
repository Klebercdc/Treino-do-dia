import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { applyClinicalRules, applyClinicalRulesFromBiomarkers, buildHealthPerformanceProfile, parsedFromBiomarkers } from "./labRules"
import type { BiomarkerEntry, HealthPerformanceProfile, LabBiomarkerTrend, LabLongitudinalContext, LabLongitudinalSignals, StoredLabContext } from "./labTypes"

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

type LabReportRow = {
  id: unknown
  parsed: unknown
  normalized_payload: unknown
  ai_insights: unknown
  confidence: unknown
  is_valid: unknown
  clinical_flags: unknown
  critical_flags: unknown
  created_at: unknown
  processed_at: unknown
}

function normalizeStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map((item) => String(item ?? "").trim()).filter(Boolean)
    : []
}

function asRecord(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string" && value.trim() === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function extractBiomarkers(normalizedPayload: Record<string, unknown> | null): BiomarkerEntry[] {
  const raw = normalizedPayload?.biomarkers
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      const row = asRecord(item)
      if (!row) return null

      return {
        marker_key: String(row.marker_key ?? row.marker ?? row.name ?? "").trim().toLowerCase(),
        marker_name: String(row.marker_name ?? row.name ?? row.marker_key ?? "Marcador").trim(),
        value_numeric: toNullableNumber(row.value_numeric),
        value_text: row.value_text == null ? null : String(row.value_text),
        unit: row.unit == null ? null : String(row.unit),
        reference_min: toNullableNumber(row.reference_min),
        reference_max: toNullableNumber(row.reference_max),
        reference_text: row.reference_text == null ? null : String(row.reference_text),
        flag: row.flag === "low" || row.flag === "high" || row.flag === "normal" ? row.flag : null,
        source_line: row.source_line == null ? null : String(row.source_line),
        confidence: toNullableNumber(row.confidence),
      } satisfies BiomarkerEntry
    })
    .filter((item): item is BiomarkerEntry => Boolean(item && item.marker_key))
}

function resolveHealthProfile(
  aiInsights: Record<string, unknown> | null,
  biomarkers: BiomarkerEntry[],
): HealthPerformanceProfile | null {
  const fromInsights = asRecord(aiInsights?.health_profile)
  if (fromInsights) return fromInsights as unknown as HealthPerformanceProfile
  if (!biomarkers.length) return null
  return buildHealthPerformanceProfile(biomarkers)
}

function mapStoredLabContext(data: LabReportRow): StoredLabContext {
  const normalizedPayload = asRecord(data.normalized_payload)
  const aiInsights = asRecord(data.ai_insights)
  const biomarkers = extractBiomarkers(normalizedPayload)
  const parsed = (data.parsed as StoredLabContext["parsed"]) || (biomarkers.length ? parsedFromBiomarkers(biomarkers) : null)
  const fallbackClinical = biomarkers.length ? applyClinicalRulesFromBiomarkers(biomarkers) : applyClinicalRules(parsed)
  const clinicalFlags = normalizeStringArray(aiInsights?.clinical_flags ?? data.clinical_flags)
  const criticalFlags = normalizeStringArray(aiInsights?.critical_flags ?? data.critical_flags)

  return {
    id: String(data.id),
    createdAt: typeof data.processed_at === "string"
      ? data.processed_at
      : typeof data.created_at === "string"
        ? data.created_at
        : null,
    confidence: Number(data.confidence || 0),
    mode: (clinicalFlags.length || criticalFlags.length || fallbackClinical.mode === "clinical") ? "clinical" : "standard",
    parsed,
    isValid: Boolean(data.is_valid),
    clinicalFlags: clinicalFlags.length ? clinicalFlags : fallbackClinical.clinicalFlags,
    criticalFlags: criticalFlags.length ? criticalFlags : fallbackClinical.criticalFlags,
    healthProfile: resolveHealthProfile(aiInsights, biomarkers),
  }
}

async function listValidLabReports(
  admin: SupabaseClient,
  userId: string,
  limit: number,
): Promise<LabReportRow[]> {
  const { data, error } = await admin
    .from("lab_reports")
    .select("id, parsed, normalized_payload, ai_insights, confidence, is_valid, clinical_flags, critical_flags, created_at, processed_at")
    .eq("user_id", userId)
    .eq("is_valid", true)
    .order("processed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !Array.isArray(data)) return []
  return data as LabReportRow[]
}

function classifySignalDelta(current: string | null | undefined, previous: string | null | undefined): string | null {
  if (!current && !previous) return null
  if (current === previous) return "estável"
  const priority: Record<string, number> = { ok: 0, attention: 1, caution: 2, critical: 3 }
  const currentRank = current != null ? (priority[current] ?? 0) : 0
  const previousRank = previous != null ? (priority[previous] ?? 0) : 0
  if (currentRank > previousRank) return "piorou"
  if (currentRank < previousRank) return "melhorou"
  return "estável"
}

function markerDeviation(marker: {
  value_numeric: number | null
  reference_min: number | null
  reference_max: number | null
  flag: BiomarkerEntry["flag"]
}): number | null {
  const value = marker.value_numeric
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (typeof marker.reference_min === "number" && value < marker.reference_min) {
    return marker.reference_min - value
  }
  if (typeof marker.reference_max === "number" && value > marker.reference_max) {
    return value - marker.reference_max
  }
  if (marker.flag === "high" || marker.flag === "low") return 1
  return 0
}

function classifyMarkerTrend(points: BiomarkerEntry[]): LabBiomarkerTrend["status"] {
  if (!points.length) return "insufficient_data"
  const latest = points[0]
  const previous = points[1]
  const latestAbnormal = latest.flag === "high" || latest.flag === "low"
  const previousAbnormal = previous ? previous.flag === "high" || previous.flag === "low" : false
  const abnormalCount = points.filter((point) => point.flag === "high" || point.flag === "low").length

  if (!previous) {
    if (latestAbnormal) return "new_alert"
    return "insufficient_data"
  }

  if (latestAbnormal && !previousAbnormal) return "new_alert"
  if (!latestAbnormal && previousAbnormal) return "improved"

  const latestDeviation = markerDeviation(latest)
  const previousDeviation = markerDeviation(previous)

  if (latestAbnormal && previousAbnormal) {
    if (latestDeviation != null && previousDeviation != null) {
      if (latestDeviation < previousDeviation * 0.85) return "improved"
      if (latestDeviation > previousDeviation * 1.15) return "worsened"
    }
    return abnormalCount >= 2 ? "persistent_abnormal" : "worsened"
  }

  if (latestDeviation != null && previousDeviation != null) {
    if (Math.abs(latestDeviation - previousDeviation) <= 0.05) return "stable"
    return latestDeviation < previousDeviation ? "improved" : "worsened"
  }

  return "stable"
}

function buildLongitudinalSignals(reports: Array<StoredLabContext>): LabLongitudinalSignals {
  const latest = reports[0]
  const previous = reports[1]
  const latestProfile = latest?.healthProfile ?? null
  const previousProfile = previous?.healthProfile ?? null
  const persistentClinicalFlags = latest?.clinicalFlags.filter((flag) => previous?.clinicalFlags.includes(flag)) ?? []

  if (!latestProfile) {
    return {
      recovery: null,
      trainingReadiness: null,
      metabolicRisk: null,
      hormonalTrend: null,
      clinicalPersistence: null,
    }
  }

  return {
    recovery: classifySignalDelta(latestProfile.recovery_risk.level, previousProfile?.recovery_risk.level),
    trainingReadiness: classifySignalDelta(latestProfile.training_readiness.level, previousProfile?.training_readiness.level),
    metabolicRisk: classifySignalDelta(latestProfile.metabolic_health.level, previousProfile?.metabolic_health.level),
    hormonalTrend: classifySignalDelta(latestProfile.androgen_status.level, previousProfile?.androgen_status.level),
    clinicalPersistence: latest.criticalFlags.length
      ? "alerta crítico ativo"
      : persistentClinicalFlags.length
        ? "alterações persistentes"
        : latest.clinicalFlags.length
          ? "alerta recente"
          : "estável",
  }
}

function buildLongitudinalSummary(context: {
  totalReports: number
  worseningMarkers: string[]
  improvingMarkers: string[]
  persistentAbnormalMarkers: string[]
  newAlertMarkers: string[]
  latestClinicalFlags: string[]
  latestCriticalFlags: string[]
}): string | null {
  if (!context.totalReports) return null

  const parts: string[] = [`Histórico com ${context.totalReports} exame(s) válido(s).`]
  if (context.newAlertMarkers.length) parts.push(`Novos alertas: ${context.newAlertMarkers.slice(0, 3).join(", ")}.`)
  if (context.persistentAbnormalMarkers.length) parts.push(`Persistência: ${context.persistentAbnormalMarkers.slice(0, 3).join(", ")}.`)
  if (context.worseningMarkers.length) parts.push(`Piora recente: ${context.worseningMarkers.slice(0, 3).join(", ")}.`)
  if (context.improvingMarkers.length) parts.push(`Melhora recente: ${context.improvingMarkers.slice(0, 3).join(", ")}.`)
  if (context.latestCriticalFlags.length) parts.push(`Urgência clínica: ${context.latestCriticalFlags.slice(0, 3).join(", ")}.`)
  else if (context.latestClinicalFlags.length) parts.push(`Atenções atuais: ${context.latestClinicalFlags.slice(0, 3).join(", ")}.`)
  return parts.join(" ")
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
      parse_status: "uploaded",
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
  const rows = await listValidLabReports(admin, userId, 1)
  return rows[0] ? mapStoredLabContext(rows[0]) : null
}

export async function getUserLabLongitudinalContext(
  admin: SupabaseClient,
  userId: string,
): Promise<LabLongitudinalContext | null> {
  const rows = await listValidLabReports(admin, userId, 12)
  if (!rows.length) return null

  const reports = rows.map(mapStoredLabContext)
  const markerMap = new Map<string, Array<{ row: LabReportRow; biomarker: BiomarkerEntry }>>()
  const latestRow = rows[0]
  const previousRow = rows[1]

  rows.forEach((row) => {
    const normalizedPayload = asRecord(row.normalized_payload)
    const biomarkers = extractBiomarkers(normalizedPayload)
    for (const biomarker of biomarkers) {
      const points = markerMap.get(biomarker.marker_key) || []
      points.push({ row, biomarker })
      markerMap.set(biomarker.marker_key, points)
    }
  })

  const markerTimeline: LabBiomarkerTrend[] = Array.from(markerMap.entries())
    .map(([markerKey, points]) => {
      const latest = points[0]?.biomarker
      const previous = points[1]?.biomarker ?? null
      const latestRowForMarker = points[0]?.row || latestRow
      const previousRowForMarker = points[1]?.row || null
      const biomarkerPoints = points.map((item) => item.biomarker)

      return {
        markerKey,
        markerName: latest ? (latest.marker_name || markerKey) : markerKey,
        unit: latest ? latest.unit : null,
        status: classifyMarkerTrend(biomarkerPoints),
        latestReportId: String(latestRowForMarker.id),
        latestCreatedAt: typeof latestRowForMarker.processed_at === "string"
          ? latestRowForMarker.processed_at
          : typeof latestRowForMarker.created_at === "string"
            ? latestRowForMarker.created_at
            : null,
        latestValueNumeric: latest ? latest.value_numeric : null,
        latestValueText: latest ? latest.value_text : null,
        latestFlag: latest ? latest.flag : null,
        previousReportId: previousRowForMarker ? String(previousRowForMarker.id) : null,
        previousCreatedAt: previousRowForMarker
          ? (typeof previousRowForMarker.processed_at === "string"
            ? previousRowForMarker.processed_at
            : typeof previousRowForMarker.created_at === "string"
              ? previousRowForMarker.created_at
              : null)
          : null,
        previousValueNumeric: previous?.value_numeric ?? null,
        previousValueText: previous?.value_text ?? null,
        previousFlag: previous?.flag ?? null,
        abnormalCount: biomarkerPoints.filter((item) => item.flag === "high" || item.flag === "low").length,
        totalPoints: biomarkerPoints.length,
        points: points.map((point) => ({
          reportId: String(point.row.id),
          createdAt: typeof point.row.processed_at === "string"
            ? point.row.processed_at
            : typeof point.row.created_at === "string"
              ? point.row.created_at
              : null,
          valueNumeric: point.biomarker.value_numeric,
          valueText: point.biomarker.value_text,
          unit: point.biomarker.unit,
          flag: point.biomarker.flag,
        })),
      }
    })
    .sort((a, b) => a.markerName.localeCompare(b.markerName, "pt-BR"))

  const worseningMarkers = markerTimeline.filter((item) => item.status === "worsened").map((item) => item.markerName)
  const improvingMarkers = markerTimeline.filter((item) => item.status === "improved").map((item) => item.markerName)
  const stableMarkers = markerTimeline.filter((item) => item.status === "stable").map((item) => item.markerName)
  const persistentAbnormalMarkers = markerTimeline
    .filter((item) => item.abnormalCount >= 2 && (item.latestFlag === "high" || item.latestFlag === "low"))
    .map((item) => item.markerName)
  const newAlertMarkers = markerTimeline.filter((item) => item.status === "new_alert").map((item) => item.markerName)
  const signals = buildLongitudinalSignals(reports)

  return {
    totalReports: reports.length,
    latestReportId: reports[0]?.id ?? null,
    latestReportDate: reports[0]?.createdAt ?? null,
    previousReportId: reports[1]?.id ?? null,
    previousReportDate: reports[1]?.createdAt ?? null,
    latestClinicalFlags: reports[0]?.clinicalFlags ?? [],
    latestCriticalFlags: reports[0]?.criticalFlags ?? [],
    markerTimeline,
    worseningMarkers,
    improvingMarkers,
    stableMarkers,
    persistentAbnormalMarkers,
    newAlertMarkers,
    signals,
    summaryText: buildLongitudinalSummary({
      totalReports: reports.length,
      worseningMarkers,
      improvingMarkers,
      persistentAbnormalMarkers,
      newAlertMarkers,
      latestClinicalFlags: reports[0]?.clinicalFlags ?? [],
      latestCriticalFlags: reports[0]?.criticalFlags ?? [],
    }),
  }
}
