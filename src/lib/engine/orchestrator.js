import { classifyIntent } from "./intentClassifier";
import { DietFlow } from "../flows/dietFlow";
import { WorkoutAgent } from "../agents/workoutAgent";
import { ChatAgent } from "../agents/chatAgent";

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

  if (intent.domain === "diet" && intent.action === "start_diet_flow") {
    return await DietFlow.start(user);
  }

  const resposta = await ChatAgent.respond(message, user, intent);

  return {
    type: "chat",
    uiAction: "none",
    response: resposta,
    intent
  };
}
