import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"
import type { PlanRepository, SaveGeneratedPlanInput } from "./persistence"
import type { AssistantStructuredResponse } from "./types"

export class SupabasePlanRepository implements PlanRepository {
  private readonly supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY)
  }

  async saveGeneratedPlan(input: SaveGeneratedPlanInput): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("generated_plans")
      .insert({
        user_id: input.userId,
        kind: input.kind,
        chat_message: input.chatMessage,
        payload: input.payload,
        created_at: input.createdAt ?? new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error) throw new Error(`Erro ao salvar plano: ${error.message}`)
    return { id: String(data.id) }
  }

  async saveAssistantLog(input: {
    userId?: string
    userMessage: string
    responseMessage: string
    intent: string
    action: string
    rawResponse: AssistantStructuredResponse
    retrievedContext?: unknown
    memoryItems?: unknown
    createdAt?: string
  }): Promise<void> {
    const { error } = await this.supabase.from("assistant_logs").insert({
      user_id: input.userId ?? null,
      user_message: input.userMessage,
      response_message: input.responseMessage,
      intent: input.intent,
      action: input.action,
      raw_response: input.rawResponse,
      retrieved_context: input.retrievedContext ?? null,
      memory_items: input.memoryItems ?? null,
      created_at: input.createdAt ?? new Date().toISOString(),
    })

    if (error) throw new Error(`Erro ao salvar log: ${error.message}`)
  }
}
