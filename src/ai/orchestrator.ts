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
      memoryItems = await this.memoryRepository.getRelevantMemory({
        userId: args.userId,
        query: args.userMessage,
        limit: 8,
      })
    }

    const response = await this.brain.think({
      ...args,
      memoryItems,
    })

    const appAction = resolveAppAction(response)

    let pdfHtml: string | undefined
    if (appAction.type === "pdf") {
      pdfHtml = buildDietHtml(appAction.payload)
    }

    let planId: string | undefined
    if (this.repository) {
      const persisted = await persistAssistantResult({
        repository: this.repository,
        userId: args.userId,
        userMessage: args.userMessage,
        response,
        retrievedContext: args.retrievedContext,
        memoryItems,
      })
      planId = persisted.planId
    }

    if (args.userId && this.memoryRepository) {
      const memories = selectMemoryWorthPersisting({
        userId: args.userId,
        userMessage: args.userMessage,
        assistantMessage: response.message,
      })

      for (const memory of memories) {
        await this.memoryRepository.saveMemory(memory)
      }
    }

    return {
      response,
      appAction,
      pdfHtml,
      planId,
    }
  }
}
