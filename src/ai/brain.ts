import { KRONIA_SYSTEM_PROMPT } from "./systemPrompt"
import { safeJsonParse } from "./json"
import { validateAssistantResponse } from "./validator"
import { buildUserMessageBundle } from "./contextBuilder"
import { IntentAgent } from "./intentAgent"
import { classifyIntent } from "./intentClassifier"
import type {
  AIModelClient,
  AIRequestInput,
  AssistantStructuredResponse,
  ChatMessage,
} from "./types"

const PAYLOAD_INTENTS = new Set(["treino", "dieta", "suplementacao", "mobilidade"])

export class KroniaBrain {
  private readonly intentAgent: IntentAgent

  constructor(private readonly modelClient: AIModelClient) {
    this.intentAgent = new IntentAgent(modelClient)
  }

  async think(input: AIRequestInput): Promise<AssistantStructuredResponse> {
    // IntentAgent classifica semanticamente antes de chamar o modelo principal.
    // Isso determina o limite de tokens sem enviar dicas enviesadas ao LLM.
    const classification = await this.intentAgent.classify({
      userMessage: input.userMessage,
      history: input.history,
      userProfile: input.userProfile,
    })

    // Se o IntentAgent falhou (caiu em fallback "chat"), usa o classificador
    // de palavras como segurança para não truncar payloads de treino/dieta.
    const keywordIntent = classifyIntent(input.userMessage)
    const likelyNeedsPayload =
      classification.needsPayload || PAYLOAD_INTENTS.has(keywordIntent)

    const syntheticUserPrompt = buildUserMessageBundle({
      ...input,
      sourceOfTruthMode: input.sourceOfTruthMode ?? "rag_required",
    })

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: syntheticUserPrompt,
      },
    ]

    const maxTokens = likelyNeedsPayload ? 1800 : 600

    const raw = await this.modelClient.generate({
      systemPrompt: KRONIA_SYSTEM_PROMPT,
      messages,
      temperature: 0.2,
      maxTokens,
    })

    const parsed = safeJsonParse<AssistantStructuredResponse>(raw)
    return validateAssistantResponse(parsed)
  }
}
