function normalize(value = "") {
  return value.toLowerCase().trim();
}

export function validateDietProteins(dietJson, allowedProteins = []) {
  const allowed = allowedProteins.map(normalize);
  const forbiddenPreparationTerms = [
    "grelhado",
    "cozido",
    "mexido",
    "assado",
    "frito",
    "temperado",
    "com sal"
  ];

  for (const refeicao of dietJson.refeicoes || []) {
    for (const item of refeicao.itens || []) {
      const alimento = normalize(item.alimento);

      const isProteinMention =
        alimento.includes("frango") ||
        alimento.includes("ovo") ||
        alimento.includes("patinho") ||
        alimento.includes("carne") ||
        alimento.includes("peixe") ||
        alimento.includes("whey");

      if (isProteinMention) {
        const permitted = allowed.some((protein) => alimento.includes(protein));

        if (!permitted) {
          throw new Error(`Proteína fora da lista permitida: ${item.alimento}`);
        }
      }

      const hasForbiddenPreparation = forbiddenPreparationTerms.some((term) =>
        alimento.includes(term)
      );

      if (hasForbiddenPreparation) {
        throw new Error(`Modo de preparo não permitido sem solicitação: ${item.alimento}`);
      }
    }
  }

  return true;
}
