import { createChatHandler } from "./createChatHandler"
import { SupabasePlanRepository } from "./supabasePlanRepository"
import { SupabaseMemoryRepository } from "./supabaseMemoryRepository"
import { SupabaseRagProvider } from "./supabaseRagProvider"
import { createEmbeddingProvider } from "./embeddings"

const repository = new SupabasePlanRepository()
const memoryRepository = new SupabaseMemoryRepository()
const ragProvider = new SupabaseRagProvider(createEmbeddingProvider())

export const handleChat = createChatHandler({
  ragProvider,
  repository,
  memoryRepository,
})
