import { KRONIA_SYSTEM_PROMPT } from "./systemPrompt"
import { safeJsonParse } from "./json"
import { validateAssistantResponse } from "./validator"
import { buildUserMessageBundle } from "./contextBuilder"
import { IntentAgent } from "./intentAgent"
import type {
  AIModelClient,
  AIRequestInput,
  AssistantStructuredResponse,
  ChatMessage,
} from "./types"

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

    // Tokens altos apenas quando o IntentAgent confirmou que há payload necessário
    const maxTokens = classification.needsPayload ? 1800 : 600

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
