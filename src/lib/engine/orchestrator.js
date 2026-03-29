import { classifyIntent } from "./intentClassifier";
import { classifySupplementIntent } from "./supplementClassifier";
import { DietFlow } from "../flows/dietFlow";
import { WorkoutAgent } from "../agents/workoutAgent";
import { ChatAgent } from "../agents/chatAgent";
import { SupplementAgent } from "../agents/supplementAgent";
import { SupplementStackAgent } from "../agents/supplementStackAgent";

export async function orchestrate(message, user) {
  const intent = classifyIntent(message);

  if (user.mode === "diet_flow") {
    return await DietFlow.next(user, message);
  }

  if (intent.domain === "workout" && intent.action === "generate_workout") {
    const treino = await WorkoutAgent.generate(user, message);

    return {
      type: "workout_result",
      uiAction: "send_to_exercise_table",
      response: "Treino gerado e enviado para sua tabela de exercícios.",
      data: treino,
      intent
    };
  }

  if (intent.domain === "exercise" && intent.action === "discover_exercise") {
    return {
      type: "exercise_discovery",
      uiAction: "discover_exercise",
      response: "Entendi seu pedido de exercício. Vou buscar a melhor opção com mídia premium.",
      data: {
        query: message,
      },
      intent,
    };
  }

  if (intent.domain === "diet" && intent.action === "start_diet_flow") {
    return await DietFlow.start(user);
  }

  const supplementIntent = classifySupplementIntent(message);

  if (supplementIntent.domain === "supplement") {
    if (supplementIntent.action === "build_stack") {
      const stack = await SupplementStackAgent.build(user, message);

      return {
        type: "supplement_stack",
        uiAction: "show_supplement_result",
        response: "Estratégia de suplementação montada.",
        data: stack,
        intent: supplementIntent
      };
    }

    const supplementResponse = await SupplementAgent.respond(message, user);

    return {
      type: "supplement_chat",
      uiAction: "show_supplement_result",
      response: supplementResponse,
      intent: supplementIntent
    };
  }

  const resposta = await ChatAgent.respond(message, user, intent);

  return {
    type: "chat",
    uiAction: "none",
    response: resposta,
    intent
  };
}
