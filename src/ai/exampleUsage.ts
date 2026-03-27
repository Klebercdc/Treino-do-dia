import { GroqClient } from "./modelClient"
import { KroniaOrchestrator } from "./orchestrator"
import type { ChatMessage, RetrievedContextItem, UserProfile } from "./types"

async function main() {
  const modelClient = new GroqClient()
  const orchestrator = new KroniaOrchestrator(modelClient)

  const history: ChatMessage[] = [
    { role: "user", content: "Quero secar e preservar massa muscular" },
    { role: "assistant", content: "Entendi. Você quer ajuda com treino, dieta ou os dois?" },
  ]

  const userProfile: UserProfile = {
    nome: "Usuário",
    objetivo: "Emagrecimento com preservação de massa",
    nivel: "Intermediário",
    restricoes: ["Sem lactose"],
    preferencias: ["Comidas simples"],
  }

  const retrievedContext: RetrievedContextItem[] = [
    {
      id: "1",
      title: "Diretriz interna de dieta hipocalórica",
      content: "Priorizar proteínas magras, vegetais, distribuição simples e aderência do usuário.",
      score: 0.98,
    },
  ]

  const result = await orchestrator.run({
    userId: "user-123",
    userMessage: "Monte uma dieta simples para eu baixar em PDF",
    history,
    userProfile,
    retrievedContext,
    sourceOfTruthMode: "rag_required",
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
