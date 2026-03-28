import { AI_ENV } from "./env"
import type { AIModelClient, ChatMessage } from "./types"

type GroqMessage = {
  role: "system" | "user" | "assistant"
  content: string
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

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_ENV.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_ENV.MODEL,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 800,
        response_format: { type: "json_object" },
        messages,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Erro Groq: ${res.status} ${text}`)
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content

    if (!content || typeof content !== "string") {
      throw new Error("Groq não retornou conteúdo")
    }

    return content
  }
}
