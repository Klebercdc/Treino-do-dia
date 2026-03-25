function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function classifySupplementIntent(message) {
  const msg = normalizeText(message);

  const performancePatterns = [
    "creatina",
    "whey",
    "cafeina",
    "pré treino",
    "pre treino",
    "pre-treino",
    "beta alanina",
    "beta-alanina",
    "citrulina",
    "palatinose",
    "intra treino",
    "intra-treino",
    "termogenico",
    "termogênico"
  ];

  const vitaminPatterns = [
    "vitamina d",
    "vitamina b12",
    "vitamina b",
    "complexo b",
    "multivitaminico",
    "multivitamínico",
    "zinco",
    "magnesio",
    "magnésio",
    "ferro",
    "omega 3",
    "ômega 3",
    "omega-3",
    "eletrólitos",
    "eletrolitos"
  ];

  const explicitRecommendationPatterns = [
    "quais suplementos",
    "quais suplementos eu tomo",
    "me indica suplemento",
    "me passe suplementacao",
    "monte minha suplementacao",
    "faz minha suplementacao",
    "crie minha suplementacao",
    "monta minha suplementacao"
  ];

  if (hasAny(msg, explicitRecommendationPatterns)) {
    return {
      domain: "supplement",
      action: "build_stack",
      confidence: 0.98,
      reason: "pedido explícito para montar suplementação"
    };
  }

  if (hasAny(msg, performancePatterns)) {
    return {
      domain: "supplement",
      action: "performance_analysis",
      confidence: 0.92,
      reason: "assunto principal é suplementação de performance"
    };
  }

  if (hasAny(msg, vitaminPatterns)) {
    return {
      domain: "supplement",
      action: "micronutrient_analysis",
      confidence: 0.92,
      reason: "assunto principal é vitamina, mineral ou correção de micronutriente"
    };
  }

  return {
    domain: "supplement",
    action: "general_analysis",
    confidence: 0.70,
    reason: "tema de suplementação sem pedido altamente específico"
  };
}
