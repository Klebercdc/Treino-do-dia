export const WorkoutAgent = {
  async generate(user, message) {
    const evidenceReferences = Array.isArray(user?.scientificConstraints?.evidenceReferences)
      ? user.scientificConstraints.evidenceReferences.filter(Boolean)
      : [];

    if (!evidenceReferences.length) {
      return {
        failSafe: true,
        flow_state: "referenced_data_required",
        treinos: [],
        references: [],
        observacoes: [
          "Treino não gerado: faltam referências explícitas validadas.",
          "O fluxo conversacional deve coletar e anexar evidenceReferences antes de montar a prescrição.",
        ],
        requestContext: {
          message: String(message || ""),
        },
      };
    }

    return {
      failSafe: true,
      flow_state: "manual_review_required",
      treinos: [],
      references: evidenceReferences,
      observacoes: [
        "Referências recebidas, mas o agente legado de treino não está autorizado a montar prescrição automaticamente.",
        "Use o pipeline oficial referenciado para emitir workout_primary.",
      ],
      requestContext: {
        message: String(message || ""),
      },
    };
  }
};
