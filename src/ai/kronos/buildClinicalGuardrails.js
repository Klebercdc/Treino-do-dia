"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var buildClinicalGuardrails_exports = {};
__export(buildClinicalGuardrails_exports, {
  buildClinicalGuardrails: () => buildClinicalGuardrails
});
module.exports = __toCommonJS(buildClinicalGuardrails_exports);
const ROLE_BY_DOMAIN = {
  treino: "m\xE9dico do esporte",
  dieta: "endocrinologista esportivo",
  exames: "endocrinologista com integra\xE7\xE3o em medicina do esporte",
  misto: "m\xE9dico do esporte + endocrinologista esportivo"
};
const DOMAIN_RULES = {
  treino: [
    "calibrar volume, intensidade, frequ\xEAncia e recupera\xE7\xE3o pelo estado cl\xEDnico e exames",
    "considerar fadiga, prontid\xE3o, hist\xF3rico recente, cargas e ader\xEAncia",
    "n\xE3o prescrever progress\xE3o agressiva quando houver alerta laboratorial ou patologia limitante"
  ],
  dieta: [
    "usar alimentos e gramas reais do plano quando dispon\xEDveis",
    "usar macros reais do plano atual quando dispon\xEDveis",
    "n\xE3o montar dieta apenas para bater calorias",
    "n\xE3o duplicar alimentos sem justificativa cl\xEDnica ou operacional"
  ],
  exames: [
    "transformar biomarcadores alterados em impacto cl\xEDnico pr\xE1tico",
    "ajustar treino e dieta conforme altera\xE7\xF5es laboratoriais relevantes",
    "n\xE3o dizer que n\xE3o tem acesso se exames.disponivel for true"
  ],
  misto: [
    "integrar treino, dieta, exames e patologia em uma \xFAnica linha de racioc\xEDnio",
    "priorizar restri\xE7\xF5es cl\xEDnicas antes de metas est\xE9ticas ou performance",
    "explicar decis\xF5es pr\xE1ticas com base nos dados reais dispon\xEDveis"
  ]
};
const COMMON_RULES = [
  "n\xE3o inventar dados cl\xEDnicos, laboratoriais, treino, dieta, calorias, macros ou gramas",
  "considerar a patologia do usu\xE1rio como restri\xE7\xE3o obrigat\xF3ria e n\xE3o como prefer\xEAncia",
  "cruzar exames, patologia, treino e dieta antes de recomendar ajuste",
  "diferenciar dado real presente, dado ausente e infer\xEAncia cl\xEDnica",
  "n\xE3o substituir consulta m\xE9dica, diagn\xF3stico formal ou conduta emergencial",
  "se houver sinal cr\xEDtico ou incompat\xEDvel com exerc\xEDcio intenso, orientar avalia\xE7\xE3o m\xE9dica"
];
function buildClinicalGuardrails(input) {
  const domain = (input && "key" in input ? input : input?.domain) ?? {};
  const key = domain.key ?? "misto";
  const role = ROLE_BY_DOMAIN[key] ?? ROLE_BY_DOMAIN["misto"];
  return {
    domain: key,
    physicianRole: role,
    requiredRules: [...COMMON_RULES, ...DOMAIN_RULES[key] ?? DOMAIN_RULES["misto"]],
    responseContract: [
      "responder de forma espec\xEDfica ao pedido do usu\xE1rio",
      "usar recomenda\xE7\xF5es acion\xE1veis e proporcionais ao contexto",
      "quando faltar dado cr\xEDtico, declarar exatamente o dado faltante"
    ]
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildClinicalGuardrails
});
