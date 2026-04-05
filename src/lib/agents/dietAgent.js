import dietServiceModule from "../../services/diet/dietService";

const dietService = dietServiceModule && typeof dietServiceModule.execute === "function"
  ? dietServiceModule
  : (dietServiceModule && dietServiceModule.default && typeof dietServiceModule.default.execute === "function"
      ? dietServiceModule.default
      : null);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAllowedProteins(raw = "") {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDietFlowInput(data) {
  const safe = data && typeof data === "object" ? data : {};
  const restrictions = String(safe.restricoes || "").trim();
  const proteins = parseAllowedProteins(safe.proteinas_permitidas);

  return {
    objetivo: String(safe.objetivo || "manutencao").trim() || "manutencao",
    peso: toNumber(safe.peso),
    altura: toNumber(safe.altura),
    idade: toNumber(safe.idade),
    sexo: String(safe.sexo || "").trim() || undefined,
    rotina: String(safe.rotina || "").trim() || undefined,
    nivelAtividade: String(safe.rotina || "").trim() || undefined,
    restricoes: restrictions,
    preferencias: proteins.join(", "),
    alimentosEvitar: "",
    refeicoesPorDia: 4,
    observacoes: proteins.length
      ? `Proteínas preferidas pelo usuário: ${proteins.join(", ")}.`
      : "",
  };
}

export const DietAgent = {
  async generate(data) {
    if (!dietService || typeof dietService.execute !== "function") {
      return {
        failSafe: true,
        observacoes: ["Serviço oficial de dieta indisponível no fluxo legado."],
        refeicoes: [],
      };
    }

    const payload = normalizeDietFlowInput(data);
    const result = await dietService.execute("GENERATE_DIET", payload);
    if (result && result.payload && result.payload.plan) {
      return result.payload.plan;
    }

    return {
      failSafe: true,
      observacoes: ["Não foi possível gerar a dieta pelo serviço oficial."],
      refeicoes: [],
    };
  }
};
