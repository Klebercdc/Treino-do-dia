import { KRONIA_SYSTEM_PROMPT } from "./systemPrompt"
import { safeJsonParse } from "./json"
import { validateAssistantResponse } from "./validator"
import { buildUserMessageBundle } from "./contextBuilder"
import { classifyIntent } from "./intentClassifier"
import type {
  AIModelClient,
  AIRequestInput,
  AssistantStructuredResponse,
  ChatMessage,
} from "./types"

export class KroniaBrain {
  constructor(private readonly modelClient: AIModelClient) {}

  async think(input: AIRequestInput): Promise<AssistantStructuredResponse> {
    const previousAssistant = [...input.history].reverse().find((m) => m.role === "assistant")?.content
    // O classificador de palavras é usado apenas para otimizar o limite de tokens.
    // A classificação real de intenção é feita semanticamente pelo LLM via system prompt.
    const tokenHint = classifyIntent(input.userMessage, previousAssistant)

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

    const payloadIntents = new Set(["treino", "dieta", "suplementacao", "mobilidade"])
    const maxTokens = payloadIntents.has(tokenHint) ? 1800 : 600

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
