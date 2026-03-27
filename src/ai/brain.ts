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
    const hintIntent = classifyIntent(input.userMessage, previousAssistant)

    const syntheticUserPrompt = buildUserMessageBundle({
      ...input,
      sourceOfTruthMode: input.sourceOfTruthMode ?? "rag_required",
    })

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          `INTENÇÃO SUGERIDA PELO CLASSIFICADOR: ${hintIntent}`,
          "",
          syntheticUserPrompt,
        ].join("\n"),
      },
    ]

    const raw = await this.modelClient.generate({
      systemPrompt: KRONIA_SYSTEM_PROMPT,
      messages,
      temperature: 0.2,
      maxTokens: 1800,
    })

    const parsed = safeJsonParse<AssistantStructuredResponse>(raw)
    return validateAssistantResponse(parsed)
  }
}
