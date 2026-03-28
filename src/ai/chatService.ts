import { GroqClient } from "./modelClient"
import { KroniaOrchestrator } from "./orchestrator"
import type {
  ChatMessage,
  RetrievedContextItem,
  UserProfile,
} from "./types"
import type { PlanRepository } from "./persistence"
import type { RagProvider } from "./rag"
import type { MemoryRepository } from "./memory"

export interface ChatServiceInput {
  userId?: string
  userMessage: string
  history: ChatMessage[]
  userProfile?: UserProfile | null
}

export class KroniaChatService {
  private readonly orchestrator: KroniaOrchestrator

  constructor(
    private readonly ragProvider: RagProvider,
    repository?: PlanRepository,
    memoryRepository?: MemoryRepository,
  ) {
    const modelClient = new GroqClient()
    this.orchestrator = new KroniaOrchestrator(modelClient, repository, memoryRepository)
  }

  async run(input: ChatServiceInput) {
    // RAG pode falhar (função não existe no DB, timeout, etc).
    // Nunca deve derrubar a request — continua com contexto vazio.
    let retrievedContext: RetrievedContextItem[] = []
    try {
      retrievedContext = await this.ragProvider.search({
        userId: input.userId,
        query: input.userMessage,
        topK: 8,
      })
    } catch {
      // sem contexto recuperado — o modelo continuará com perfil e memória
    }

    return this.orchestrator.run({
      userId: input.userId,
      userMessage: input.userMessage,
      history: input.history,
      userProfile: input.userProfile,
      retrievedContext,
      sourceOfTruthMode: "rag_required",
    })
  }
}
