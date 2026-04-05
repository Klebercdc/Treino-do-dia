export const WorkoutFlow = {
  steps: ["objetivo", "nivel", "dias"],

  async start(user) {
    user.mode = "workout_flow";
    user.step = 0;
    user.data = {};

    return {
      type: "workout_flow",
      uiAction: "open_workout_screen",
      response: "Qual seu objetivo de treino?"
    };
  },

  async next(user, message) {
    user.data[this.steps[user.step]] = message;
    user.step += 1;

    if (user.step >= this.steps.length) {
      user.mode = null;

      return {
        type: "workout_flow_ready",
        uiAction: "open_workout_screen",
        response: "Dados coletados. Abra o configurador oficial para gerar um treino referenciado.",
        data: user.data,
      };
    }

    const questions = [
      "Qual seu nível? Ex.: iniciante, intermediário, avançado.",
      "Quantos dias por semana você treina?"
    ];

    return {
      type: "workout_flow",
      uiAction: "open_workout_screen",
      response: questions[user.step - 1]
    };
  }
};
