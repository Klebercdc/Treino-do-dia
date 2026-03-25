import { alimentos } from "./foodDatabase";

export function ajustarDieta(dieta, macrosTarget) {
  let total = { kcal: 0, prot: 0, carb: 0, gord: 0 };

  function calcularTotal() {
    total = { kcal: 0, prot: 0, carb: 0, gord: 0 };

    Object.values(dieta).forEach((ref) => {
      ref.forEach((item) => {
        const base = alimentos[item.alimento];
        if (!base) return;

        total.kcal += base.kcal * item.qtd;
        total.prot += base.prot * item.qtd;
        total.carb += base.carb * item.qtd;
        total.gord += base.gord * item.qtd;
      });
    });
  }

  calcularTotal();

  // LOOP DE AJUSTE
  while (total.kcal < macrosTarget.calorias) {
    dieta.almoco.push({ alimento: "arroz", qtd: 1 });
    calcularTotal();
  }

  return { dieta, total };
}
