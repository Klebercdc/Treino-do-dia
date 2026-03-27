import { createChatHandler } from "./createChatHandler"
import { SupabasePlanRepository } from "./supabasePlanRepository"
import { SupabaseMemoryRepository } from "./supabaseMemoryRepository"
import { SupabaseRagProvider } from "./supabaseRagProvider"
import { PlaceholderEmbeddingProvider } from "./embeddings"

const repository = new SupabasePlanRepository()
const memoryRepository = new SupabaseMemoryRepository()
const ragProvider = new SupabaseRagProvider(new PlaceholderEmbeddingProvider())

export const handleChat = createChatHandler({
  ragProvider,
  repository,
  memoryRepository,
})
