function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function safeJsonParse<T>(raw: string): T {
  const trimmed = raw.trim()

  // 1. Tenta direto
  const direct = tryParse<T>(trimmed)
  if (direct !== null) return direct

  // 2. Extrai JSON de bloco markdown (```json ... ``` ou ``` ... ```)
  const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (markdownMatch) {
    const fromMarkdown = tryParse<T>(markdownMatch[1].trim())
    if (fromMarkdown !== null) return fromMarkdown
  }

  // 3. Extrai o maior bloco { ... } da string
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1)
    const fromBraces = tryParse<T>(sliced)
    if (fromBraces !== null) return fromBraces
  }

  // 4. Tenta reparar JSON truncado adicionando fechamentos
  if (firstBrace >= 0) {
    const partial = trimmed.slice(firstBrace)
    const repaired = partial
      .replace(/,\s*$/, "")   // vírgula final pendente
      .replace(/:\s*$/, ": null") // chave sem valor
    const withClose = repaired.endsWith("}") ? repaired : repaired + '"}'
    const fromRepaired = tryParse<T>(withClose)
    if (fromRepaired !== null) return fromRepaired
  }

  throw new Error("A resposta da IA não está em JSON válido")
}
