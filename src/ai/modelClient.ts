import { AI_ENV } from "./env"
import type { AIModelClient, ChatMessage } from "./types"

type GroqMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const RETRY_DELAYS_MS = [1000, 3000]

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class GroqClient implements AIModelClient {
  async generate(input: {
    systemPrompt: string
    messages: ChatMessage[]
    temperature?: number
    maxTokens?: number
  }): Promise<string> {
    const messages: GroqMessage[] = [
      { role: "system", content: input.systemPrompt },
      ...input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    const body = JSON.stringify({
      model: AI_ENV.MODEL,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 800,
      response_format: { type: "json_object" },
      messages,
    })

    let lastError: Error = new Error("Groq não respondeu")

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS_MS[attempt - 1])
      }

      let res: Response
      try {
        res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AI_ENV.GROQ_API_KEY}`,
          },
          body,
        })
      } catch (networkError) {
        lastError = new Error(`Falha de rede: ${networkError}`)
        continue
      }

      if (!res.ok) {
        if (RETRYABLE_STATUS.has(res.status)) {
          lastError = new Error(`Groq ${res.status}`)
          continue
        }
        const text = await res.text()
        throw new Error(`Erro Groq: ${res.status} ${text}`)
      }

      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content

      if (!content || typeof content !== "string") {
        lastError = new Error("Groq não retornou conteúdo")
        continue
      }

      return content
    }

    throw lastError
  }
}
