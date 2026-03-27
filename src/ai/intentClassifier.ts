import type { AssistantIntent } from "./types"

const containsAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term))

export function classifyIntent(message: string, previousAssistantMessage?: string): AssistantIntent {
  const text = message.trim().toLowerCase()

  const treinoTerms = [
    "quero um treino",
    "monte um treino",
    "gera um treino",
    "gere um treino",
    "crie um treino",
    "fazer um treino",
    "me passa um treino",
    "treino para mim",
    "ajuste meu treino",
    "monta treino",
  ]

  const dietaTerms = [
    "quero uma dieta",
    "monte uma dieta",
    "gera uma dieta",
    "gere uma dieta",
    "crie uma dieta",
    "me passa uma dieta",
    "plano alimentar",
    "cardápio",
    "cardapio",
    "ajuste minha dieta",
  ]

  const suplementoTerms = [
    "suplement",
    "creatina",
    "whey",
    "pré treino",
    "pre treino",
    "vitamina",
    "magnésio",
    "magnesio",
    "termogênico",
    "termogenico",
  ]

  const mobilidadeTerms = [
    "mobilidade",
    "alongamento",
    "alongar",
    "travado",
    "encurtamento",
    "dor ao agachar",
    "dor no ombro",
    "dor no quadril",
    "tornozelo duro",
  ]

  const configTerms = [
    "configurar",
    "ajustar",
    "editar",
    "personalizar",
    "montar",
    "organizar",
  ]

  const directActionTerms = [
    "crie",
    "gere",
    "monte",
    "faça",
    "faz",
    "me dê",
    "me de",
    "quero",
    "preciso",
  ]

  if (containsAny(text, treinoTerms)) return "treino"
  if (containsAny(text, dietaTerms)) return "dieta"
  if (containsAny(text, suplementoTerms) && containsAny(text, directActionTerms)) return "suplementacao"
  if (containsAny(text, mobilidadeTerms) && containsAny(text, directActionTerms)) return "mobilidade"

  if (
    text === "treino" ||
    text === "dieta" ||
    text === "suplementação" ||
    text === "suplementacao" ||
    text === "mobilidade"
  ) {
    return "duvida"
  }

  if (containsAny(text, configTerms) && text.includes("treino")) return "configuracao"
  if (containsAny(text, configTerms) && (text.includes("dieta") || text.includes("cardápio") || text.includes("cardapio"))) {
    return "configuracao"
  }

  const conversationTerms = [
    "estou cansado",
    "to cansado",
    "tô cansado",
    "nao consegui treinar",
    "não consegui treinar",
    "estou sem fome",
    "comi mal",
    "estou desmotivado",
    "to desmotivado",
    "tô desmotivado",
    "estou indisposto",
    "acordei ruim",
    "estou travado",
    "estou com dor",
  ]

  if (containsAny(text, conversationTerms)) return "chat"
  if (text.includes("?")) return "duvida"
  if (previousAssistantMessage && text.length < 40) return "continuidade"

  return "chat"
}
