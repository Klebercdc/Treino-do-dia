import type { AssistantIntent } from "./types"

const containsAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term))

export function classifyIntent(message: string, previousAssistantMessage?: string): AssistantIntent {
  const text = message.trim().toLowerCase()

  const treinoTerms = [
    "quero um treino",
    "quero treino",
    "monte um treino",
    "monta um treino",
    "monta treino",
    "montar treino",
    "gera um treino",
    "gere um treino",
    "gerar treino",
    "crie um treino",
    "criar treino",
    "fazer um treino",
    "me passa um treino",
    "me manda um treino",
    "treino para mim",
    "ajuste meu treino",
    "ajusta meu treino",
    "muda meu treino",
    "novo treino",
    "um treino de",
    "treino de força",
    "treino de resistência",
    "treino de resistencia",
    "treino de hipertrofia",
    "treino de emagrecimento",
    "treino de funcional",
    "preciso de um treino",
    "pode me dar um treino",
    "me faz um treino",
    "faz um treino",
    "me gera um treino",
  ]

  const dietaTerms = [
    "quero uma dieta",
    "quero dieta",
    "monte uma dieta",
    "monta uma dieta",
    "montar dieta",
    "gera uma dieta",
    "gere uma dieta",
    "gerar dieta",
    "crie uma dieta",
    "criar dieta",
    "me passa uma dieta",
    "me manda uma dieta",
    "plano alimentar",
    "cardápio",
    "cardapio",
    "ajuste minha dieta",
    "ajusta minha dieta",
    "muda minha dieta",
    "nova dieta",
    "preciso de uma dieta",
    "pode me dar uma dieta",
    "me faz uma dieta",
    "faz uma dieta",
  ]

  const suplementoTerms = [
    "suplement",
    "creatina",
    "whey",
    "pré treino",
    "pre treino",
    "pre-treino",
    "vitamina",
    "magnésio",
    "magnesio",
    "termogênico",
    "termogenico",
    "bcaa",
    "proteína em pó",
    "proteina em po",
    "caseína",
    "caseina",
    "glutamina",
    "omega 3",
    "ômega 3",
  ]

  const mobilidadeTerms = [
    "mobilidade",
    "alongamento",
    "alongar",
    "encurtamento",
    "dor ao agachar",
    "dor no ombro",
    "dor no quadril",
    "tornozelo duro",
    "flexibilidade",
    "exercício de mobilidade",
    "exercicio de mobilidade",
    "plano de alongamento",
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
    "me passa",
    "me manda",
    "me faz",
  ]

  // Termos que claramente são CHAT/RELATO — nunca devem virar ação
  const chatOnlyTerms = [
    "estou cansado",
    "tô cansado",
    "to cansado",
    "nao consegui treinar",
    "não consegui treinar",
    "não treinei",
    "nao treinei",
    "estou sem fome",
    "comi mal",
    "comi pouco",
    "estou desmotivado",
    "tô desmotivado",
    "to desmotivado",
    "estou indisposto",
    "acordei ruim",
    "acordei mal",
    "estou com dor",
    "tô com dor",
    "sinto dor",
    "estou travado",
    "tô travado",
    "estou treinando",
    "tô treinando",
    "to treinando",
    "tenho treinado",
    "meu objetivo é",
    "meu foco é",
    "estou focado",
  ]

  if (containsAny(text, chatOnlyTerms)) return "chat"

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

  if (text.includes("?")) return "duvida"
  if (previousAssistantMessage && text.length < 40) return "continuidade"

  return "chat"
}
