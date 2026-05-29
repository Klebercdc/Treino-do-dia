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
var resolveKronosClinicalDomain_exports = {};
__export(resolveKronosClinicalDomain_exports, {
  resolveKronosClinicalDomain: () => resolveKronosClinicalDomain
});
module.exports = __toCommonJS(resolveKronosClinicalDomain_exports);
function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function scoreMatch(text, patterns) {
  return patterns.reduce((score, pattern) => pattern.test(text) ? score + 1 : score, 0);
}
function resolveKronosClinicalDomain(input) {
  const options = input && typeof input === "object" ? input : {};
  const text = normalizeText([
    options.topic,
    options.intent,
    options.message,
    options.userMessage
  ].filter(Boolean).join(" "));
  const workoutScore = scoreMatch(text, [
    /\btreino\b/,
    /\btreinar\b/,
    /\bmusculacao\b/,
    /\bcardio\b/,
    /\bforca\b/,
    /\bvolume\b/,
    /\bseries?\b/,
    /\brepeticoes\b/,
    /\bcarga\b/,
    /\brpe\b/,
    /\bfadiga\b/,
    /\brecuperacao\b/,
    /\bperformance\b/,
    /\bworkout\b/
  ]);
  const dietScore = scoreMatch(text, [
    /\bdieta\b/,
    /\bnutricao\b/,
    /\brefeicao\b/,
    /\balimento\b/,
    /\bgramas\b/,
    /\bmacro/,
    /\bcaloria/,
    /\bproteina\b/,
    /\bcarbo/,
    /\bgordura\b/,
    /\bemagrecer\b/,
    /\bcutting\b/,
    /\bbulking\b/
  ]);
  const labsScore = scoreMatch(text, [
    /\bexames?\b/,
    /\blaudo\b/,
    /\blaborator/,
    /\bbiomarcador/,
    /\bhemograma\b/,
    /\bcolesterol\b/,
    /\bglicose\b/,
    /\binsulina\b/,
    /\btsh\b/,
    /\bferritina\b/,
    /\btestosterona\b/,
    /\bvitamina d\b/,
    /\bcreatinina\b/,
    /\bhdl\b/,
    /\bldl\b/
  ]);
  const matched = [
    workoutScore > 0 ? "treino" : null,
    dietScore > 0 ? "dieta" : null,
    labsScore > 0 ? "exames" : null
  ].filter((x) => x !== null);
  if (matched.length > 1) {
    return {
      key: "misto",
      label: "abordagem integrada",
      physicianRole: "m\xE9dico do esporte + endocrinologia esportiva",
      matchedDomains: matched,
      confidence: "high"
    };
  }
  if (labsScore > 0) {
    return {
      key: "exames",
      label: "endocrinologia + esporte",
      physicianRole: "endocrinologista com integra\xE7\xE3o em medicina do esporte",
      matchedDomains: ["exames"],
      confidence: labsScore >= 2 ? "high" : "medium"
    };
  }
  if (dietScore > 0) {
    return {
      key: "dieta",
      label: "endocrinologia esportiva",
      physicianRole: "endocrinologista esportivo",
      matchedDomains: ["dieta"],
      confidence: dietScore >= 2 ? "high" : "medium"
    };
  }
  if (workoutScore > 0) {
    return {
      key: "treino",
      label: "m\xE9dico do esporte",
      physicianRole: "m\xE9dico do esporte",
      matchedDomains: ["treino"],
      confidence: workoutScore >= 2 ? "high" : "medium"
    };
  }
  return {
    key: "misto",
    label: "abordagem integrada",
    physicianRole: "m\xE9dico do esporte + endocrinologia esportiva",
    matchedDomains: ["treino", "dieta", "exames"],
    confidence: "low"
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  resolveKronosClinicalDomain
});
