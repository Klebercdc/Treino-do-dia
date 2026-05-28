import { callClaude } from "../services/claude";
import { classifySupplementIntent } from "../engine/supplementClassifier";
import askKronosModule from "../../ai/kronos/askKronos";

const { askKronos } = askKronosModule;

function buildSupplementContext(user = {}) {
  return {
    objetivo: user?.profile?.objetivo || null,
    peso: user?.profile?.peso || null,
    altura: user?.profile?.altura || null,
    idade: user?.profile?.idade || null,
    sexo: user?.profile?.sexo || null,
    rotina: user?.profile?.rotina || null,
    nivelTreino: user?.profile?.nivel || null,
    restricoes: user?.profile?.restricoes || null,
    plano: user?.plan || "free"
  };
}

export const SupplementAgent = {
  async respond(message, user) {
    const intent = classifySupplementIntent(message);
    const context = buildSupplementContext(user);

    const userMessage = `
MENSAGEM DO USUÁRIO:
${message}

CONTEXTO LEGADO COMPLEMENTAR:
${JSON.stringify(context, null, 2)}

INTENÇÃO:
${JSON.stringify(intent, null, 2)}

REGRAS DE COMPORTAMENTO:
1. Não responder de forma genérica.
2. Não listar suplementos aleatoriamente.
3. Separar a resposta em:
   - o que faz sentido
   - o que depende de contexto
   - o que depende de exame/laboratório
   - o que não é prioridade
4. Diferenciar:
   - performance
   - recuperação
   - déficit nutricional
   - praticidade alimentar
   - suporte geral
5. Quando falar de vitaminas e minerais, pensar como especialista em correção de base e risco de deficiência, não como “atalho”.
6. Quando falar de termogênicos, analisar tolerância, sensibilidade, objetivo, sono e estímulos.
7. Não agir como vendedor de suplemento.
8. Priorizar raciocínio técnico.
9. Se a pergunta pedir recomendação, montar uma estratégia e justificar cada item.
10. Sempre informar quando um item depende de exame, sintomas, uso crônico de medicamento, restrição alimentar ou ingestão insuficiente.
11. Não prescrever ferro, vitamina D, B12 ou outros micronutrientes como se fosse tudo igual para todos.
12. Se o contexto estiver incompleto, faça no máximo 3 perguntas objetivas antes de montar uma estratégia.
13. Se já houver contexto suficiente, responda direto.

COMO RESPONDER:
- Seja específico.
- Seja inteligente.
- Seja prático.
- Fale como especialista real.

FORMATO DE RESPOSTA:
1. Leitura do cenário
2. Suplementos prioritários
3. Suplementos condicionais
4. O que não é prioridade agora
5. Observação final de segurança/contexto

SE O USUÁRIO PEDIR UMA ESTRATÉGIA COMPLETA:
Monte uma estrutura assim:
- base
- performance
- saúde/micronutrientes
- opcionais
- alertas

SUPLEMENTOS QUE VOCÊ DOMINA:
- creatina
- whey
- caseína
- cafeína
- beta-alanina
- citrulina
- eletrólitos
- ômega-3
- vitamina D
- vitamina B12
- complexo B
- magnésio
- zinco
- ferro
- multivitamínico
- termogênicos
- pré-treinos

REGRAS ESPECIAIS POR CATEGORIA:
A) Creatina:
- tratar como suplemento de base quando fizer sentido para treino de força, hipertrofia e performance.
B) Whey:
- tratar como ferramenta de praticidade para bater proteína, não como mágica.
C) Cafeína:
- pensar em horário, sensibilidade, ansiedade, sono e objetivo.
D) Vitamina D:
- tratar como micronutriente importante, mas dependente de contexto e muitas vezes laboratório.
E) B12:
- tratar com atenção especial em ingestão baixa, dieta restrita, absorção e sintomas.
F) Ferro:
- não banalizar.
G) Termogênicos:
- analisar risco/benefício, sono, pressão, ansiedade, tolerância e composição.

NUNCA RESPONDA COMO TEXTO VAZIO OU GENÉRICO.
`;

    const result = await askKronos({
      message: userMessage,
      userId: user?.id,
      intent: "supplement_guidance",
      topic: "supplement",
      mode: "full",
      maxTokens: 1400,
      callLLM: async ({ systemPrompt, userMessage }) => {
        return await callClaude(`${systemPrompt}\n\nMENSAGEM DO USUÁRIO:\n${userMessage}`);
      },
    });

    return result.response;
  }
};
