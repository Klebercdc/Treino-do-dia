import type { PlanRepository } from "./persistence"
import type { RagProvider } from "./rag"
import type { MemoryRepository } from "./memory"
import { KroniaChatService } from "./chatService"
import type { ChatMessage, UserProfile } from "./types"

export interface ChatApiRequestBody {
  userId?: string
  message: string
  history: ChatMessage[]
  userProfile?: UserProfile | null
}

export interface ChatApiSuccessResponse {
  ok: true
  message: string
  response: unknown
  appAction: unknown
  pdfHtml?: string
  planId?: string
}

export interface ChatApiErrorResponse {
  ok: false
  error: string
}

export function createChatHandler(args: {
  ragProvider: RagProvider
  repository?: PlanRepository
  memoryRepository?: MemoryRepository
}) {
  const service = new KroniaChatService(args.ragProvider, args.repository, args.memoryRepository)

  return async function handleChat(body: ChatApiRequestBody): Promise<ChatApiSuccessResponse | ChatApiErrorResponse> {
    try {
      if (!body?.message || typeof body.message !== "string") {
        return { ok: false, error: "Mensagem inválida" }
      }

      if (!Array.isArray(body.history)) {
        return { ok: false, error: "Histórico inválido" }
      }

      const result = await service.run({
        userId: body.userId,
        userMessage: body.message,
        history: body.history,
        userProfile: body.userProfile ?? null,
      })

      return {
        ok: true,
        message: result.response.message,
        response: result.response,
        appAction: result.appAction,
        pdfHtml: result.pdfHtml,
        planId: result.planId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno no chat"
      return { ok: false, error: message }
    }
  }
}
