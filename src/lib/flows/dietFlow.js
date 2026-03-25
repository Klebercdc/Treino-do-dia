import { DietAgent } from "../agents/dietAgent";

export const DietFlow = {
  steps: [
    "objetivo",
    "peso",
    "altura",
    "idade",
    "rotina",
    "restricoes",
    "proteinas_permitidas"
  ],

  questions: {
    objetivo: "Qual seu objetivo? Ex.: emagrecer, hipertrofia, manter.",
    peso: "Qual seu peso atual em kg?",
    altura: "Qual sua altura em cm?",
    idade: "Qual sua idade?",
    rotina: "Como é sua rotina diária?",
    restricoes: "Tem alguma restrição alimentar ou alimento que não quer usar?",
    proteinas_permitidas: "Quais proteínas você quer que eu use na dieta? Ex.: frango, ovo, patinho."
  },

  async start(user) {
    user.mode = "diet_flow";
    user.step = 0;
    user.data = {};

    return {
      type: "diet_flow",
      uiAction: "open_diet_screen",
      response: this.questions[this.steps[0]]
    };
  },

  async next(user, message) {
    const currentKey = this.steps[user.step];
    user.data[currentKey] = message;
    user.step += 1;

    if (user.step >= this.steps.length) {
      user.mode = null;

      const dieta = await DietAgent.generate(user.data);

      return {
        type: "diet_result",
        uiAction: "show_diet_result",
        response: "Dieta gerada com base nas proteínas e regras definidas.",
        data: dieta
      };
    }

    const nextKey = this.steps[user.step];

    return {
      type: "diet_flow",
      uiAction: "open_diet_screen",
      response: this.questions[nextKey]
    };
  }
};
