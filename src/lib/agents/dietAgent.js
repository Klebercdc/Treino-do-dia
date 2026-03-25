import { callClaude } from "../services/claude";
import { validateDietProteins } from "../validators/dietValidator";

function parseAllowedProteins(raw = "") {
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export const DietAgent = {
  async generate(data) {
    const allowedProteins = parseAllowedProteins(data.proteinas_permitidas || "");

    const prompt = `
Você é KRONOS, especialista em nutrição esportiva.

Monte uma dieta personalizada em JSON.

DADOS DO USUÁRIO:
- Objetivo: ${data.objetivo}
- Peso: ${data.peso}
- Altura: ${data.altura}
- Idade: ${data.idade}
- Rotina: ${data.rotina}
- Restrições: ${data.restricoes}

PROTEÍNAS PERMITIDAS:
${JSON.stringify(allowedProteins)}

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE as proteínas permitidas.
2. Não invente proteínas fora da lista.
3. Se a lista tiver "frango", "ovo" e "patinho", use somente essas três.
4. Não invente modo de preparo sem necessidade.
5. Se o usuário não definiu preparo, escreva apenas o alimento base. Ex.: "frango", "ovo", "patinho".
6. Monte refeições práticas dentro da realidade brasileira.
7. Não usar palavras como "grelhado", "com sal", "temperado", "mexido" a menos que isso tenha sido solicitado.
8. Organize por refeições.
9. Retorne SOMENTE JSON válido.
10. Estrutura obrigatória:

{
  "meta": {
    "objetivo": "",
    "observacoes": []
  },
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "horario": "07:00",
      "itens": [
        { "alimento": "", "quantidade": "" }
      ]
    }
  ]
}

11. Se alguma proteína da lista não fizer sentido em alguma refeição, apenas não use. Mas nunca invente outra.
12. Não usar alimentos fora da lógica pedida.
13. Respeitar estritamente a lista de proteínas permitidas.
`;

    const resposta = await callClaude(prompt);
    const dieta = JSON.parse(resposta);

    validateDietProteins(dieta, allowedProteins);

    return dieta;
  }
};
