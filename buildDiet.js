import { calcularCalorias } from "./calorieCalculator";
import { calcularMacros } from "./macroCalculator";
import { gerarDieta } from "./dietGenerator";
import { ajustarDieta } from "./adjustDiet";

export function buildDiet(user) {
  const calorias = calcularCalorias(user);
  const macros = calcularMacros(calorias, user.peso);

  const dieta = gerarDieta(macros);

  const resultado = ajustarDieta(dieta, {
    calorias,
    ...macros,
  });

  return {
    dieta: resultado.dieta,
    total: resultado.total,
    meta: { calorias, ...macros },
  };
}
