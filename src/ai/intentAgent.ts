import type { AIModelClient, AssistantIntent, ChatMessage, UserProfile } from "./types"
import { safeJsonParse } from "./json"
import { AI_ENV } from "./env"

export interface IntentClassificationResult {
  intent: AssistantIntent
  needsPayload: boolean
  requiresClarification: boolean
}

const INTENT_AGENT_PROMPT = `
Você é um classificador de intenção de uma IA de fitness chamada KRONOS.

Sua única função é analisar a mensagem do usuário e retornar a intenção real, com base no significado — não em palavras exatas.

CATEGORIAS DE INTENÇÃO:

- "treino": o usuário quer que a IA GERE ou AJUSTE um treino. Exemplos: "quero um treino", "me monta algo pra resistência", "preciso de uma rotina de exercícios", "cria algo pra eu fazer na academia".
- "dieta": o usuário quer que a IA GERE ou AJUSTE uma dieta ou cardápio. Exemplos: "me faz um plano alimentar", "quero comer melhor, me ajuda?", "preciso de um cardápio".
- "suplementacao": o usuário quer recomendação pessoal ou geração de protocolo de suplementos. Exemplos: "o que devo tomar?", "me indica um suplemento", "preciso de creatina?", "quero um protocolo de suplementação". NÃO inclui: perguntas sobre fontes/referências da IA, perguntas técnicas sobre o que é um suplemento, ou qualquer pergunta sobre o conhecimento do assistente.
- "mobilidade": o usuário quer um plano de alongamento ou mobilidade. Exemplos: "preciso de exercícios pra mobilidade", "me ajuda com alongamento".
- "ajuste": o usuário quer MODIFICAR algo já gerado anteriormente (treino, dieta, etc.).
- "configuracao": o usuário quer abrir configurações, ajustar preferências no app.
- "duvida": o usuário faz uma PERGUNTA técnica ou geral, quer aprender ou entender algo. Inclui perguntas sobre suplementos, sobre fontes de referência da IA, ou sobre o próprio assistente. Exemplos: "qual a diferença entre whey concentrado e isolado?", "quantas proteínas devo comer?", "o que é periodização?", "qual sua referência de suplemento?", "qual sua base científica?".
- "continuidade": o usuário está respondendo diretamente ao que a IA disse, com frase curta sem mudar de assunto.
- "chat": o usuário está relatando algo, cumprimentando, desabafando, compartilhando contexto do dia, mas NÃO está pedindo geração de nenhum conteúdo. Exemplos: "estou cansado hoje", "não treinei essa semana", "tô focado em resistência", "meu objetivo é emagrecer".
- "acao_direta": o usuário quer executar uma ação específica no app (abrir tela, gerar PDF, etc.).

REGRAS CRÍTICAS:
1. Mensagens de RELATO, CONTEXTO ou ESTADO ("estou treinando", "meu foco é", "hoje fiz") = "chat", nunca "treino".
2. Só classifique "treino"/"dieta"/"suplementacao"/"mobilidade" se houver PEDIDO IMPLÍCITO ou EXPLÍCITO de geração para o usuário.
3. Perguntas com "como", "por que", "qual", "quando", "o que", "qual sua" = "duvida".
4. Perguntas sobre as referências, fontes ou conhecimento da IA = "duvida", NUNCA "suplementacao".
5. Em caso de dúvida entre "chat" e outro intent, prefira "chat".
6. Use o histórico recente para entender contexto de continuidade.

CAMPO needsPayload: true apenas se intent for treino, dieta, suplementacao ou mobilidade E o usuário claramente quer a geração (não só tirar dúvida).
CAMPO requiresClarification: true se a mensagem for ambígua e precisar de pergunta antes de agir.

Responda SOMENTE em JSON válido, sem texto fora do JSON:
{
  "intent": "<uma das categorias acima>",
  "needsPayload": <true|false>,
  "requiresClarification": <true|false>
}
`.trim()

export class IntentAgent {
  constructor(private readonly modelClient: AIModelClient) {}

  async classify(input: {
    userMessage: string
    history: ChatMessage[]
    userProfile?: UserProfile | null
  }): Promise<IntentClassificationResult> {
    const recentHistory = input.history.slice(-4)
    const historyText = recentHistory.length > 0
      ? recentHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
      : "Sem histórico."

    const userContent = [
      "HISTÓRICO RECENTE:",
      historyText,
      "",
      "MENSAGEM DO USUÁRIO:",
      input.userMessage,
    ].join("\n")

    try {
      const raw = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_ENV.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.0,
          max_tokens: 120,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INTENT_AGENT_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      })

      if (!raw.ok) {
        return this.fallback()
      }

      const json = await raw.json()
      const content = json?.choices?.[0]?.message?.content

      if (!content || typeof content !== "string") {
        return this.fallback()
      }

      const parsed = safeJsonParse<Partial<IntentClassificationResult>>(content)
      if (!parsed || !this.isValidIntent(parsed.intent)) {
        return this.fallback()
      }

      return {
        intent: parsed.intent as AssistantIntent,
        needsPayload: parsed.needsPayload ?? false,
        requiresClarification: parsed.requiresClarification ?? false,
      }
    } catch {
      return this.fallback()
    }
  }

  private isValidIntent(intent: unknown): intent is AssistantIntent {
    const valid: AssistantIntent[] = [
      "chat", "treino", "dieta", "suplementacao", "mobilidade",
      "ajuste", "duvida", "continuidade", "configuracao", "acao_direta",
    ]
    return typeof intent === "string" && valid.includes(intent as AssistantIntent)
  }

  private fallback(): IntentClassificationResult {
    return { intent: "chat", needsPayload: false, requiresClarification: false }
  }
}
