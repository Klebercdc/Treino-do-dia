/**
 * /api/kronia/workout/templates
 *
 * GET  → lista os templates salvos do usuário
 * POST → cria ou substitui o conjunto de templates do usuário (upsert)
 * DELETE ?id=<templateId> → remove um template pelo id dentro do array JSONB
 */

import { NextRequest, NextResponse } from "next/server"
import { requireBearerAuth } from "../../../_shared/requireBearerAuth"
import { createAdminSupabaseClient } from "../../../../../lib/supabase/admin"

export const runtime = "nodejs"

function buildError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.ok) return auth.response as Response

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from("workout_templates")
    .select("id, templates, updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[templates-route] GET error:", error)
    return buildError(500, "Erro ao buscar templates.")
  }

  const templates = Array.isArray(data?.templates) ? data.templates : []
  return NextResponse.json({ ok: true, templates, updatedAt: data?.updated_at ?? null })
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.ok) return auth.response as Response

  const body = await req.json().catch(() => null)
  if (!body || !body.template || typeof body.template !== "object") {
    return buildError(400, "Payload inválido. Envie { template: {...} }.")
  }

  const newTemplate = body.template
  // Garante que o template tem um id
  if (!newTemplate.id) {
    newTemplate.id = crypto.randomUUID()
  }
  if (!newTemplate.name) {
    newTemplate.name = `Template ${new Date().toLocaleDateString("pt-BR")}`
  }
  newTemplate.savedAt = new Date().toISOString()

  // Valida estrutura mínima: deve ter pelo menos um treino com exercícios
  const treinos = Array.isArray(newTemplate.treinos) ? newTemplate.treinos : []
  const validTreinos = treinos.filter((t: any) =>
    t && typeof t === "object" &&
    Array.isArray(t.exercicios) &&
    t.exercicios.length > 0,
  )
  if (validTreinos.length === 0) {
    return buildError(422, "Template inválido: é necessário pelo menos um treino com exercícios.")
  }
  newTemplate.treinos = validTreinos

  const admin = createAdminSupabaseClient()

  // Busca row existente
  const { data: existing } = await admin
    .from("workout_templates")
    .select("id, templates")
    .eq("user_id", auth.user.id)
    .maybeSingle()

  const currentTemplates: any[] = Array.isArray(existing?.templates)
    ? existing.templates
    : []

  // Substitui se id igual, senão append (limite de 10 templates por usuário)
  const MAX_TEMPLATES = 10
  const idx = currentTemplates.findIndex((t: any) => t.id === newTemplate.id)
  let updatedTemplates: any[]
  if (idx >= 0) {
    updatedTemplates = [...currentTemplates]
    updatedTemplates[idx] = newTemplate
  } else {
    updatedTemplates = [newTemplate, ...currentTemplates].slice(0, MAX_TEMPLATES)
  }

  const { error: upsertError } = await admin
    .from("workout_templates")
    .upsert(
      { user_id: auth.user.id, templates: updatedTemplates, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )

  if (upsertError) {
    console.error("[templates-route] POST upsert error:", upsertError)
    return buildError(500, "Erro ao salvar template.")
  }

  return NextResponse.json({ ok: true, template: newTemplate, templates: updatedTemplates })
}

// ── DELETE ─────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireBearerAuth(req)
  if (!auth.ok) return auth.response as Response

  const { searchParams } = new URL(req.url)
  const templateId = searchParams.get("id")
  if (!templateId) return buildError(400, "Parâmetro id é obrigatório.")

  const admin = createAdminSupabaseClient()
  const { data: existing, error: fetchError } = await admin
    .from("workout_templates")
    .select("id, templates")
    .eq("user_id", auth.user.id)
    .maybeSingle()

  if (fetchError || !existing) {
    return buildError(404, "Nenhum template encontrado.")
  }

  const updated = (Array.isArray(existing.templates) ? existing.templates : []).filter(
    (t: any) => t.id !== templateId,
  )

  const { error: updateError } = await admin
    .from("workout_templates")
    .update({ templates: updated, updated_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)

  if (updateError) {
    console.error("[templates-route] DELETE error:", updateError)
    return buildError(500, "Erro ao remover template.")
  }

  return NextResponse.json({ ok: true, deletedId: templateId, templates: updated })
}
