export function validar(resultado) {
  const diff = Math.abs(resultado.total.kcal - resultado.meta.calorias);

  if (diff > 100) {
    throw new Error("Dieta fora da meta");
  }

  return true;
}
