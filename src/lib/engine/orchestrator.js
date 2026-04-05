import { classifyIntent } from "./intentClassifier";
import { classifySupplementIntent } from "./supplementClassifier";
import { DietFlow } from "../flows/dietFlow";
import { WorkoutAgent } from "../agents/workoutAgent";
import { ChatAgent } from "../agents/chatAgent";
import { SupplementAgent } from "../agents/supplementAgent";
import { SupplementStackAgent } from "../agents/supplementStackAgent";
import { KroniaExerciseApplication } from "../exercises/application";
import { createAdminSupabaseClient } from "../supabase/admin";

export async function orchestrate(message, user) {
  const intent = classifyIntent(message);

  if (user.mode === "diet_flow") {
    return await DietFlow.next(user, message);
  }

  if (intent.domain === "workout" && intent.action === "generate_workout") {
    const treino = await WorkoutAgent.generate(user, message);
    const workoutType = treino && treino.failSafe ? "workout_failsafe" : "workout_primary";

    return {
      type: workoutType,
      uiAction: treino && treino.failSafe ? "none" : "send_to_exercise_table",
      response: treino && treino.failSafe
        ? "Não gerei um treino especulativo. Faltam referências explícitas validadas para sustentar a prescrição."
        : "Treino gerado e enviado para sua tabela de exercícios.",
      data: treino,
      intent
    };
  }

  if (intent.domain === "exercise" && intent.action === "discover_exercise") {
    const adminDb = createAdminSupabaseClient();
    const exerciseApp = new KroniaExerciseApplication(adminDb);
    const result = await exerciseApp.searchExercisesByContext({
      userId: user.id,
      message,
      locale: "pt",
    });
    const found = result.status === "success" && result.data;
    return {
      type: "exercise_discovery",
      uiAction: "discover_exercise",
      response: found
        ? `Encontrei: **${result.data.names?.pt || result.data.names?.en}** (${result.data.muscles?.target || ""}). Músculos secundários: ${(result.data.muscles?.secondary || []).join(", ") || "—"}.`
        : "Não encontrei um exercício específico. Tente ser mais preciso (ex: 'supino reto com barra').",
      data: found ? result.data : null,
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
