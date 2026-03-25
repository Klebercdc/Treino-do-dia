import { callClaude } from "../services/claude";

export const WorkoutAgent = {
  async generate(user, message) {
    const prompt = `
Você é KRONOS, especialista em treinamento de musculação.

Monte um treino em JSON com base na mensagem do usuário e nos dados já existentes.

DADOS DO USUÁRIO:
${JSON.stringify(user, null, 2)}

MENSAGEM:
${message}

RETORNE SOMENTE JSON VÁLIDO NO FORMATO:
{
  "objetivo": "",
  "divisao": "",
  "exercicios": [
    {
      "nome": "",
      "series": 4,
      "repeticoes": "8-12",
      "descanso": "60-90s"
    }
  ]
}
`;

    const resposta = await callClaude(prompt);
    return JSON.parse(resposta);
  }
};
