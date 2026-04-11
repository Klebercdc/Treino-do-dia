import type { SupabaseClient } from "@supabase/supabase-js"
import { GroqClient } from "./modelClient"
import { KroniaOrchestrator } from "./orchestrator"
import { buildLongitudinalLabContext, getLabReportsForLongitudinal, getLatestValidLabReport } from "../core/labs/labRepository"
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
    private readonly adminClient?: SupabaseClient,
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

    let labHealthProfile = null
    let labLongitudinalContext = null
    if (input.userId && this.adminClient) {
      try {
        const latestLabReport = await getLatestValidLabReport(this.adminClient, input.userId)
        labHealthProfile = latestLabReport?.healthProfile ?? null
      } catch {
        // falha ao carregar exames não derruba o chat
      }
      try {
        const allReports = await getLabReportsForLongitudinal(this.adminClient, input.userId, 10)
        if (allReports.length >= 1) {
          labLongitudinalContext = buildLongitudinalLabContext(allReports)
        }
      } catch {
        // falha longitudinal não derruba o chat
      }
    }

    return this.orchestrator.run({
      userId: input.userId,
      userMessage: input.userMessage,
      history: input.history,
      userProfile: input.userProfile,
      labHealthProfile,
      labLongitudinalContext,
      retrievedContext,
      sourceOfTruthMode: retrievedContext.length ? "rag_required" : "rag_preferred",
    })
  }
}
