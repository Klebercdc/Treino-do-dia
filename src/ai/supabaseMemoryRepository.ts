import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { AI_ENV } from "./env"
import type { MemoryItem } from "./types"
import type { MemoryRepository } from "./memory"

interface SupabaseMemoryRow {
  id: string | number
  user_id: string
  memory_type: MemoryItem["memoryType"]
  content: string
  importance?: number
  created_at?: string
  updated_at?: string
}

export class SupabaseMemoryRepository implements MemoryRepository {
  private readonly supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(AI_ENV.SUPABASE_URL, AI_ENV.SUPABASE_SERVICE_ROLE_KEY)
  }

  async getRelevantMemory(input: {
    userId: string
    query: string
    limit?: number
  }): Promise<MemoryItem[]> {
    const { data, error } = await this.supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", input.userId)
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 8)

    if (error) throw new Error(`Erro ao buscar memória: ${error.message}`)

    return (data ?? []).map((row: SupabaseMemoryRow) => ({
      id: String(row.id),
      userId: String(row.user_id),
      memoryType: row.memory_type,
      content: String(row.content),
      importance: typeof row.importance === "number" ? row.importance : undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    }))
  }

  async saveMemory(input: MemoryItem): Promise<void> {
    const { error } = await this.supabase.from("user_memory").insert({
      user_id: input.userId,
      memory_type: input.memoryType,
      content: input.content,
      importance: input.importance ?? 0.5,
      created_at: input.createdAt ?? new Date().toISOString(),
      updated_at: input.updatedAt ?? new Date().toISOString(),
    })

    if (error) throw new Error(`Erro ao salvar memória: ${error.message}`)
  }
}
