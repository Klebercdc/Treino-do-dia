import type { MemoryItem } from "./types"

export interface MemoryRepository {
  getRelevantMemory(input: {
    userId: string
    query: string
    limit?: number
  }): Promise<MemoryItem[]>

  saveMemory(input: MemoryItem): Promise<void>
}

export function selectMemoryWorthPersisting(args: {
  userId: string
  userMessage: string
  assistantMessage: string
}): MemoryItem[] {
  const text = args.userMessage.toLowerCase()
  const items: MemoryItem[] = []

  const capture = (memoryType: MemoryItem["memoryType"], content: string, importance = 0.7) => {
    items.push({
      userId: args.userId,
      memoryType,
      content,
      importance,
    })
  }

  if (text.includes("sem lactose")) capture("restricao", "Usuário informou restrição ou preferência sem lactose.", 0.95)
  if (text.includes("quero emagrecer")) capture("objetivo", "Usuário quer emagrecer.", 0.9)
  if (text.includes("hipertrof")) capture("objetivo", "Usuário quer hipertrofia.", 0.9)
  if (text.includes("lesão") || text.includes("lesao")) capture("lesao", `Usuário relatou limitação: ${args.userMessage}`, 0.95)
  if (text.includes("prefiro")) capture("preferencia", `Preferência do usuário: ${args.userMessage}`, 0.85)
  if (text.includes("trabalho") || text.includes("rotina")) capture("rotina", `Contexto de rotina: ${args.userMessage}`, 0.75)

  return items
}
