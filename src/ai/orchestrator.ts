import { KroniaBrain } from "./brain"
import { resolveAppAction } from "./router"
import { buildDietHtml } from "./pdfDietGenerator"
import { persistAssistantResult, type PlanRepository } from "./persistence"
import type { MemoryRepository } from "./memory"
import { selectMemoryWorthPersisting } from "./memory"
import type { AIModelClient, AIRequestInput, AssistantStructuredResponse } from "./types"

export interface OrchestratorResult {
  response: AssistantStructuredResponse
  appAction: ReturnType<typeof resolveAppAction>
  pdfHtml?: string
  planId?: string
}

const FALLBACK_RESPONSE: AssistantStructuredResponse = {
  intent: "chat",
  action: "responder_chat",
  depth: "curta",
  shouldCreateButton: false,
  buttonType: null,
  message: "Tive um problema ao processar sua mensagem. Pode tentar novamente?",
  workoutPayload: null,
  dietPayload: null,
  supplementPayload: null,
  mobilityPayload: null,
}

export class KroniaOrchestrator {
  private readonly brain: KroniaBrain

  constructor(
    modelClient: AIModelClient,
    private readonly repository?: PlanRepository,
    private readonly memoryRepository?: MemoryRepository,
  ) {
    this.brain = new KroniaBrain(modelClient)
  }

  async run(args: AIRequestInput): Promise<OrchestratorResult> {
    let memoryItems = args.memoryItems ?? []

    if (args.userId && this.memoryRepository && memoryItems.length === 0) {
      try {
        memoryItems = await this.memoryRepository.getRelevantMemory({
          userId: args.userId,
          query: args.userMessage,
          limit: 8,
        })
      } catch {
        // memória indisponível — continua sem ela
      }
    }

    let response: AssistantStructuredResponse
    try {
      response = await this.brain.think({ ...args, memoryItems })
    } catch {
      // Falha total do modelo — retorna mensagem amigável em vez de 500
      return {
        response: FALLBACK_RESPONSE,
        appAction: { type: "chat" },
      }
    }

    const appAction = resolveAppAction(response)

    let pdfHtml: string | undefined
    if (appAction.type === "pdf") {
      pdfHtml = buildDietHtml(appAction.payload)
    }

    let planId: string | undefined
    if (this.repository) {
      try {
        const persisted = await persistAssistantResult({
          repository: this.repository,
          userId: args.userId,
          userMessage: args.userMessage,
          response,
          retrievedContext: args.retrievedContext,
          memoryItems,
        })
        planId = persisted.planId
      } catch {
        // falha ao persistir não interrompe a resposta ao usuário
      }
    }

    if (args.userId && this.memoryRepository) {
      try {
        const memories = selectMemoryWorthPersisting({
          userId: args.userId,
          userMessage: args.userMessage,
          assistantMessage: response.message,
        })
        for (const memory of memories) {
          await this.memoryRepository.saveMemory(memory)
        }
      } catch {
        // falha ao salvar memória não interrompe o fluxo
      }
    }

    return { response, appAction, pdfHtml, planId }
  }
}
