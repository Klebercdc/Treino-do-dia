'use strict';

var promptBuilder = require('./buildKronosSystemPrompt');
var domainResolver = require('./resolveKronosClinicalDomain');
var evidenceContextBuilder = require('./buildClinicalEvidenceContext');
var guardrailsBuilder = require('./buildClinicalGuardrails');
var examInterpreter = require('./interpretarExames');

function getDefaultBuildKronosContext() {
  return require('./buildKronosContext').buildKronosContext;
}

function buildClinicalContextForExams(ctx) {
  var clinical = Object.assign({}, ctx && ctx.contextoClinico ? ctx.contextoClinico : {});
  var patologias = []
    .concat(Array.isArray(clinical.patologias) ? clinical.patologias : [])
    .concat(ctx && ctx.user && ctx.user.patologia ? [ctx.user.patologia] : [])
    .concat(ctx && ctx.user && Array.isArray(ctx.user.patologias) ? ctx.user.patologias : []);
  var seen = Object.create(null);
  clinical.patologias = patologias.filter(function (item) {
    var clean = String(item || '').trim();
    var key = clean.toLowerCase();
    if (!clean || seen[key]) return false;
    seen[key] = true;
    return true;
  });
  return clinical;
}

function withClinicalAppContext(kronosContext, clinicalDomain, clinicalEvidenceContext, clinicalGuardrails) {
  var ctx = Object.assign({}, kronosContext || {});
  var originalExams = ctx.exames && typeof ctx.exames === 'object' ? ctx.exames : {};
  var interpretedExams = examInterpreter.interpretarExames(originalExams, buildClinicalContextForExams(ctx));
  ctx.examesInterpretados = interpretedExams;
  ctx.exames = Object.assign({}, originalExams, {
    disponivel: originalExams.disponivel === true || interpretedExams.disponivel,
    dataUltimaColeta: interpretedExams.dataUltimaColeta,
    alertas: interpretedExams.alertas,
    impactoClinicoPorBiomarcador: interpretedExams.impactoClinicoPorBiomarcador,
    resumoClinico: interpretedExams.resumoClinico
  });
  ctx.clinicalDomain = clinicalDomain;
  ctx.clinicalEvidenceContext = clinicalEvidenceContext;
  ctx.clinicalGuardrails = clinicalGuardrails;
  return ctx;
}

async function askKronos(input) {
  var options = input && typeof input === 'object' ? input : {};
  if (typeof options.callLLM !== 'function') {
    throw new Error('askKronos requires callLLM({ systemPrompt, userMessage, appContext })');
  }

  var message = String(options.message || options.userMessage || '').trim();
  var kronosContext = options.kronosContext || await (options.buildKronosContext || getDefaultBuildKronosContext())({
    userId: options.userId,
    message: message,
    screenContext: options.screenContext || null
  });

  var clinicalDomain = domainResolver.resolveKronosClinicalDomain({
    topic: options.topic,
    intent: options.intent,
    message: message
  });
  var clinicalEvidenceContext = await evidenceContextBuilder.buildClinicalEvidenceContext({
    kronosContext: kronosContext,
    message: message,
    topic: options.topic,
    intent: options.intent,
    clinicalDomain: clinicalDomain
  });
  var clinicalGuardrails = guardrailsBuilder.buildClinicalGuardrails(clinicalDomain);
  var appContext = withClinicalAppContext(kronosContext, clinicalDomain, clinicalEvidenceContext, clinicalGuardrails);

  var systemPrompt = promptBuilder.buildKronosSystemPrompt(appContext, options.intent, {
    mode: options.mode,
    topic: options.topic,
    maxTokens: options.maxTokens,
    clinicalDomain: clinicalDomain,
    clinicalEvidenceContext: clinicalEvidenceContext,
    clinicalGuardrails: clinicalGuardrails
  });

  var response = await options.callLLM({
    systemPrompt: systemPrompt,
    userMessage: message,
    appContext: appContext,
    history: options.history || [],
    maxTokens: options.maxTokens,
    temperature: options.temperature
  });

  return {
    response: response,
    kronosContext: appContext,
    systemPrompt: systemPrompt
  };
}

module.exports = {
  askKronos: askKronos
};
