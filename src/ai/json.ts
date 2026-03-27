export function safeJsonParse<T>(raw: string): T {
  const trimmed = raw.trim()

  try {
    return JSON.parse(trimmed) as T
  } catch {
    const firstBrace = trimmed.indexOf("{")
    const lastBrace = trimmed.lastIndexOf("}")

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = trimmed.slice(firstBrace, lastBrace + 1)
      return JSON.parse(sliced) as T
    }

    throw new Error("A resposta da IA não está em JSON válido")
  }
}
