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
var buildClinicalEvidenceContext_exports = {};
__export(buildClinicalEvidenceContext_exports, {
  buildClinicalEvidenceContext: () => buildClinicalEvidenceContext
});
module.exports = __toCommonJS(buildClinicalEvidenceContext_exports);
var import_resolveKronosClinicalDomain = require("./resolveKronosClinicalDomain");
const evidenceRepository = require("../../server/apihelpers/_clinicalEvidenceRepository");
function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function unique(values) {
  const seen = /* @__PURE__ */ Object.create(null);
  return values.reduce((acc, value) => {
    const clean = String(value ?? "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen[key]) return acc;
    seen[key] = true;
    acc.push(clean);
    return acc;
  }, []);
}
function extractBiomarkers(context) {
  const exames = context?.exames;
  if (!exames || !Array.isArray(exames.biomarcadores)) return [];
  return exames.biomarcadores.filter((m) => m?.nome && m.status && m.status !== "normal").map((m) => m.nome).slice(0, 8);
}
function extractTopics(message, clinicalDomain, context) {
  const text = normalizeText(message);
  const topics = [];
  if (clinicalDomain?.key) topics.push(clinicalDomain.key);
  if (/\btreino|musculacao|forca|cardio|fadiga|recuperacao\b/.test(text)) topics.push("treino");
  if (/\bdieta|nutricao|refeicao|proteina|caloria|macro|alimento\b/.test(text)) topics.push("dieta");
  if (/\bexame|laborator|biomarcador|glicose|colesterol|testosterona|tsh|ferritina\b/.test(text)) topics.push("exames");
  if (context?.treino?.disponivel) topics.push("treino atual");
  if (context?.dieta?.disponivel) topics.push("plano alimentar atual");
  if (context?.exames?.disponivel) topics.push("exames laboratoriais");
  return unique(topics).slice(0, 10);
}
function extractPathologies(context) {
  const clinical = context?.contextoClinico;
  const user = context?.user;
  return unique([
    ...Array.isArray(clinical?.patologias) ? clinical.patologias : [],
    ...user?.patologia ? [user.patologia] : [],
    ...Array.isArray(user?.patologias) ? user.patologias : []
  ]);
}
function buildPriorityFlags(context, pathologies, biomarkers) {
  const flags = [];
  if (pathologies.length) flags.push("patologia_obrigatoria");
  if (context?.exames?.disponivel) flags.push("cruzar_exames");
  if (biomarkers.length) flags.push("biomarcadores_alterados");
  if (context?.treino?.fatigueStatus && context.treino.fatigueStatus !== "ok") flags.push("fadiga_treino");
  if (context?.treino?.recoveryStatus && context.treino.recoveryStatus !== "ok") flags.push("recuperacao_treino");
  return unique(flags);
}
async function buildClinicalEvidenceContext(input) {
  const options = input ?? {};
  const context = options.kronosContext ?? options.context ?? {};
  const message = String(options.message ?? options.userMessage ?? "");
  const clinicalDomain = options.clinicalDomain ?? (0, import_resolveKronosClinicalDomain.resolveKronosClinicalDomain)({
    topic: options.topic,
    intent: options.intent,
    message
  });
  const pathologies = extractPathologies(context);
  const biomarkers = extractBiomarkers(context);
  const topics = extractTopics(message, clinicalDomain, context);
  const evidence = await evidenceRepository.searchClinicalEvidence(
    { domain: clinicalDomain.key, topic: topics, patologia: pathologies, biomarcador: biomarkers },
    { limit: 8 }
  );
  return {
    domain: clinicalDomain,
    evidenceAvailable: !!evidence.sources?.length,
    topics,
    sources: evidence.sources ?? [],
    clinicalFocus: {
      patologia: pathologies,
      biomarcadoresAlterados: biomarkers,
      usarTreinoReal: !!context.treino?.disponivel,
      usarDietaReal: !!context.dieta?.disponivel,
      usarExamesReais: !!context.exames?.disponivel
    },
    priorityFlags: buildPriorityFlags(context, pathologies, biomarkers),
    repository: {
      sourceTable: evidence.sourceTable ?? null,
      error: evidence.error ?? null
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildClinicalEvidenceContext
});
