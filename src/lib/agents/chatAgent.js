import { callClaude } from "../services/claude";
import askKronosModule from "../../ai/kronos/askKronos";

const { askKronos } = askKronosModule;

export const ChatAgent = {
  async respond(message, user, intent) {
    const result = await askKronos({
      message,
      userId: user?.id,
      intent: intent?.domain,
      topic: intent?.domain,
      mode: "normal",
      maxTokens: 900,
      callLLM: async ({ systemPrompt, userMessage }) => {
        return await callClaude(`${systemPrompt}\n\nMENSAGEM DO USUÁRIO:\n${userMessage}`);
      },
    });

    return result.response;
  }
};
