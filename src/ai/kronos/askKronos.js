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
var askKronos_exports = {};
__export(askKronos_exports, {
  askKronos: () => askKronos
});
module.exports = __toCommonJS(askKronos_exports);
var import_buildKronosSystemPrompt = require("./buildKronosSystemPrompt");
var import_resolveKronosClinicalDomain = require("./resolveKronosClinicalDomain");
var import_buildClinicalEvidenceContext = require("./buildClinicalEvidenceContext");
var import_buildClinicalGuardrails = require("./buildClinicalGuardrails");
var import_interpretarExames = require("./interpretarExames");
var import_buildKronosContext = require("./buildKronosContext");
function buildClinicalContextForExams(ctx) {
  const clinical = Object.assign({}, ctx.contextoClinico ?? {});
  const user = ctx.user;
  const patologias = [
    ...Array.isArray(clinical.patologias) ? clinical.patologias : [],
    ...user?.patologia ? [user.patologia] : [],
    ...Array.isArray(user?.patologias) ? user.patologias : []
  ];
  const seen = /* @__PURE__ */ Object.create(null);
  clinical.patologias = patologias.filter((item) => {
    const clean = String(item ?? "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen[key]) return false;
    seen[key] = true;
    return true;
  });
  return clinical;
}
function withClinicalAppContext(kronosContext, clinicalDomain, clinicalEvidenceContext, clinicalGuardrails) {
  const ctx = { ...kronosContext };
  const originalExams = ctx.exames && typeof ctx.exames === "object" ? ctx.exames : {};
  const interpretedExams = (0, import_interpretarExames.interpretarExames)(
    originalExams,
    buildClinicalContextForExams(ctx)
  );
  ctx.examesInterpretados = interpretedExams;
  ctx.exames = {
    ...originalExams,
    disponivel: originalExams["disponivel"] === true || interpretedExams.disponivel,
    dataUltimaColeta: interpretedExams.dataUltimaColeta,
    alertas: interpretedExams.alertas,
    impactoClinicoPorBiomarcador: interpretedExams.impactoClinicoPorBiomarcador,
    resumoClinico: interpretedExams.resumoClinico
  };
  ctx.clinicalDomain = clinicalDomain;
  ctx.clinicalEvidenceContext = clinicalEvidenceContext;
  ctx.clinicalGuardrails = clinicalGuardrails;
  return ctx;
}
async function askKronos(input) {
  if (typeof input.callLLM !== "function") {
    throw new Error("askKronos requires callLLM({ systemPrompt, userMessage, appContext })");
  }
  const message = String(input.message ?? input.userMessage ?? "").trim();
  const buildCtx = input.buildKronosContext ?? import_buildKronosContext.buildKronosContext;
  const kronosContext = input.kronosContext ?? await buildCtx({
    userId: input.userId,
    message,
    screenContext: input.screenContext ?? null
  });
  const clinicalDomain = (0, import_resolveKronosClinicalDomain.resolveKronosClinicalDomain)({
    topic: input.topic,
    intent: input.intent,
    message
  });
  const clinicalEvidenceContext = await (0, import_buildClinicalEvidenceContext.buildClinicalEvidenceContext)({
    kronosContext,
    message,
    topic: input.topic,
    intent: input.intent,
    clinicalDomain
  });
  const clinicalGuardrails = (0, import_buildClinicalGuardrails.buildClinicalGuardrails)(clinicalDomain);
  const appContext = withClinicalAppContext(kronosContext, clinicalDomain, clinicalEvidenceContext, clinicalGuardrails);
  const systemPrompt = (0, import_buildKronosSystemPrompt.buildKronosSystemPrompt)(appContext, input.intent, {
    mode: input.mode,
    topic: input.topic,
    maxTokens: input.maxTokens,
    clinicalDomain,
    clinicalEvidenceContext,
    clinicalGuardrails
  });
  const response = await input.callLLM({
    systemPrompt,
    userMessage: message,
    appContext,
    history: input.history ?? [],
    maxTokens: input.maxTokens,
    temperature: input.temperature
  });
  return { response, kronosContext: appContext, systemPrompt };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  askKronos
});
