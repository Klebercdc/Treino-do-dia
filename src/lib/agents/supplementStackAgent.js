import { callClaude } from "../services/claude";

function buildUserSupplementProfile(user = {}) {
  return {
    objetivo: user?.profile?.objetivo || null,
    peso: user?.profile?.peso || null,
    altura: user?.profile?.altura || null,
    idade: user?.profile?.idade || null,
    sexo: user?.profile?.sexo || null,
    rotina: user?.profile?.rotina || null,
    nivel: user?.profile?.nivel || null,
    treinoDias: user?.profile?.treinoDias || null,
    sono: user?.profile?.sono || null,
    dieta: user?.profile?.dieta || null,
    restricoes: user?.profile?.restricoes || null,
    sintomas: user?.profile?.sintomas || null,
    medicamentos: user?.profile?.medicamentos || null
  };
}

export const SupplementStackAgent = {
  async build(user, message) {
    const profile = buildUserSupplementProfile(user);

    const prompt = `
Você é KRONOS, especialista avançado em suplementação esportiva, vitaminas e minerais.

MONTE UMA ESTRATÉGIA DE SUPLEMENTAÇÃO INTELIGENTE E ESPECÍFICA.

PERFIL:
${JSON.stringify(profile, null, 2)}

PEDIDO:
${message}

REGRAS:
1. Não responder com lista genérica.
2. Construir uma stack racional.
3. Separar:
   - base obrigatória
   - performance
   - micronutrientes e correções
   - opcionais
4. Não incluir suplemento sem justificar.
5. Quando o item depender de exame, deixar isso explícito.
6. Quando o item depender de ingestão dietética insuficiente, deixar isso explícito.
7. Quando o item for mais útil por praticidade do que por “efeito”, deixar isso explícito.
8. Não recomendar excesso de coisa.
9. A resposta deve parecer especialista real.

FORMATO OBRIGATÓRIO:
{
  "leitura_do_caso": "",
  "base": [
    {
      "item": "",
      "motivo": "",
      "quando_faz_sentido": "",
      "alerta": ""
    }
  ],
  "performance": [
    {
      "item": "",
      "motivo": "",
      "quando_faz_sentido": "",
      "alerta": ""
    }
  ],
  "micronutrientes": [
    {
      "item": "",
      "motivo": "",
      "quando_faz_sentido": "",
      "alerta": ""
    }
  ],
  "nao_prioritario_agora": [
    {
      "item": "",
      "motivo": ""
    }
  ],
  "observacao_final": ""
}

ITENS QUE VOCÊ PODE USAR:
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

REGRAS IMPORTANTES:
- vitamina D, B12, ferro e outros micronutrientes não devem ser tratados como solução mágica.
- se houver pouca evidência para aquele cenário, diga isso.
- se o item não for prioridade, diga claramente.
- se o melhor caminho for primeiro ajustar dieta, diga claramente.
- não inventar exames; apenas dizer quando faria sentido avaliar.
`;

    const response = await callClaude(prompt);
    return JSON.parse(response);
  }
};
