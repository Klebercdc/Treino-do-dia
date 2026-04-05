import type { ChatMessage, MemoryItem, RetrievedContextItem, UserProfile } from "./types"

function serializeProfile(profile?: UserProfile | null): string {
  if (!profile) return "Sem perfil disponível."

  return [
    `nome: ${profile.nome ?? ""}`,
    `objetivo: ${profile.objetivo ?? ""}`,
    `nível: ${profile.nivel ?? ""}`,
    `idade: ${profile.idade ?? ""}`,
    `sexo: ${profile.sexo ?? ""}`,
    `pesoKg: ${profile.pesoKg ?? ""}`,
    `alturaCm: ${profile.alturaCm ?? ""}`,
    `restrições: ${(profile.restricoes ?? []).join(", ")}`,
    `preferências: ${(profile.preferencias ?? []).join(", ")}`,
    `lesões: ${(profile.lesoes ?? []).join(", ")}`,
    `rotina: ${profile.rotina ?? ""}`,
    `observações: ${profile.observacoes ?? ""}`,
  ].join("\n")
}

function serializeHistory(history: ChatMessage[]): string {
  const recent = history.slice(-8)
  return recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
}

function serializeContext(context: RetrievedContextItem[] = []): string {
  if (!context.length) return "Sem contexto recuperado."
  return context
    .slice(0, 8)
    .map((item, idx) => {
      const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {}
      const title = item.title ? `Título: ${item.title}\n` : ""
      const source = metadata.source ? `Origem: ${String(metadata.source)}\n` : ""
      const category = metadata.category ? `Categoria: ${String(metadata.category)}\n` : ""
      const href = metadata.url ? `Link: ${String(metadata.url)}\n` : ""
      const similarity = item.score != null ? `Relevância: ${Number(item.score).toFixed(3)}\n` : ""
      return `Fonte ${idx + 1}\n${title}${source}${category}${href}${similarity}Conteúdo: ${item.content}`
    })
    .join("\n\n")
}

function serializeMemory(memoryItems: MemoryItem[] = []): string {
  if (!memoryItems.length) return "Sem memória útil."
  return memoryItems
    .slice(0, 10)
    .map((m, idx) => `Memória ${idx + 1} [${m.memoryType}]: ${m.content}`)
    .join("\n")
}

export function buildUserMessageBundle(args: {
  userMessage: string
  history: ChatMessage[]
  userProfile?: UserProfile | null
  retrievedContext?: RetrievedContextItem[]
  memoryItems?: MemoryItem[]
  sourceOfTruthMode?: "rag_required" | "rag_preferred"
}): string {
  return [
    "MODO DE CONHECIMENTO:",
    args.sourceOfTruthMode === "rag_required"
      ? "Use apenas o contexto recuperado, memória útil e dados do usuário. Trate o CONTEXTO RECUPERADO como referência oficial. Se não houver contexto suficiente, diga claramente."
      : "Priorize o contexto recuperado, memória útil e dados do usuário. Trate o CONTEXTO RECUPERADO como referência oficial. Se faltar informação, diga claramente.",
    "",
    "PERFIL DO USUÁRIO:",
    serializeProfile(args.userProfile),
    "",
    "MEMÓRIA ÚTIL:",
    serializeMemory(args.memoryItems),
    "",
    "HISTÓRICO RECENTE:",
    serializeHistory(args.history),
    "",
    "CONTEXTO RECUPERADO:",
    serializeContext(args.retrievedContext),
    "",
    "MENSAGEM ATUAL DO USUÁRIO:",
    args.userMessage,
  ].join("\n")
}
