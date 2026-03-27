import { GroqClient } from "./modelClient"

export async function runAiSystemCheck(): Promise<{
  status: "OK" | "ERROR" | "SKIPPED"
  message: string
}> {
  if (!process.env.GROQ_API_KEY) {
    return {
      status: "SKIPPED",
      message: "GROQ_API_KEY not configured",
    }
  }

  try {
    const client = new GroqClient()

    const res = await client.generate({
      systemPrompt: "Responda apenas em JSON válido.",
      messages: [
        {
          role: "user",
          content: '{"ping":"ok"}',
        },
      ],
      temperature: 0,
      maxTokens: 20,
    })

    if (!res) throw new Error("Sem resposta")

    return {
      status: "OK",
      message: "Groq funcionando",
    }
  } catch (e: any) {
    return {
      status: "ERROR",
      message: e?.message ?? "Erro na IA",
    }
  }
}
