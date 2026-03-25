function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function hasPhrase(text, phrase) {
  if (!phrase || phrase.split(" ").length < 2) {
    return false;
  }

  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");

  return pattern.test(text);
}

function hasAnyPhrase(text, patterns) {
  return patterns.some((pattern) => hasPhrase(text, pattern));
}

export function classifyIntent(message) {
  const msg = normalizeText(message);

  const workoutGeneratePatterns = [
    "faz um treino",
    "faca um treino",
    "monte um treino",
    "monta um treino",
    "crie um treino",
    "gera um treino",
    "gere um treino",
    "quero um treino",
    "preciso de um treino",
    "me passa um treino",
    "criar treino",
    "gerar treino",
    "montar treino",
    "ficha de treino"
  ];

  const workoutChatPatterns = [
    "me explica treino",
    "o que acha do treino",
    "esse treino esta bom",
    "esse treino e bom",
    "treino abc",
    "treino abcde",
    "periodizacao de treino",
    "me fala sobre treino",
    "duvida sobre treino"
  ];

  const dietGeneratePatterns = [
    "faz uma dieta",
    "faca uma dieta",
    "monte uma dieta",
    "monta uma dieta",
    "crie uma dieta",
    "gera uma dieta",
    "gere uma dieta",
    "quero uma dieta",
    "preciso de uma dieta",
    "plano alimentar",
    "montar dieta",
    "gerar dieta"
  ];

  const dietChatPatterns = [
    "me explica dieta",
    "essa dieta esta boa",
    "essa dieta e boa",
    "duvida sobre dieta",
    "me fala sobre alimentacao",
    "me fala sobre nutricao",
    "o que comer",
    "como dividir macros",
    "como bater proteina",
    "como ajustar carboidrato",
    "como ajustar gordura"
  ];

  const supplementPatterns = [
    "falar sobre creatina",
    "falar sobre whey",
    "sobre suplementacao",
    "pre treino",
    "pre-treino",
    "uso de cafeina"
  ];

  if (hasAnyPhrase(msg, workoutGeneratePatterns)) {
    return {
      domain: "workout",
      action: "generate_workout",
      confidence: 0.98,
      reason: "pedido explícito de geração de treino"
    };
  }

  if (hasAnyPhrase(msg, dietGeneratePatterns)) {
    return {
      domain: "diet",
      action: "start_diet_flow",
      confidence: 0.98,
      reason: "pedido explícito de geração de dieta"
    };
  }

  if (hasAnyPhrase(msg, workoutChatPatterns)) {
    return {
      domain: "workout",
      action: "chat",
      confidence: 0.88,
      reason: "assunto é treino, mas sem pedido explícito para gerar"
    };
  }

  if (hasAnyPhrase(msg, dietChatPatterns)) {
    return {
      domain: "diet",
      action: "chat",
      confidence: 0.88,
      reason: "assunto é dieta/nutrição, mas sem pedido explícito para gerar"
    };
  }

  if (hasAnyPhrase(msg, supplementPatterns)) {
    return {
      domain: "supplement",
      action: "chat",
      confidence: 0.90,
      reason: "assunto é suplementação"
    };
  }

  return {
    domain: "general",
    action: "chat",
    confidence: 0.70,
    reason: "sem pedido estruturado de treino ou dieta"
  };
}
