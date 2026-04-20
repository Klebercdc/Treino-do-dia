'use strict';

var evidenceRepository = require('../../server/apihelpers/_clinicalEvidenceRepository');
var domainResolver = require('./resolveKronosClinicalDomain');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function unique(values) {
  var seen = Object.create(null);
  var out = [];
  (values || []).forEach(function (value) {
    var clean = String(value || '').trim();
    var key = clean.toLowerCase();
    if (!clean || seen[key]) return;
    seen[key] = true;
    out.push(clean);
  });
  return out;
}

function extractBiomarkers(context) {
  var exames = context && context.exames;
  if (!exames || !Array.isArray(exames.biomarcadores)) return [];
  return exames.biomarcadores
    .filter(function (marker) { return marker && marker.nome && marker.status && marker.status !== 'normal'; })
    .map(function (marker) { return marker.nome; })
    .slice(0, 8);
}

function extractTopics(message, clinicalDomain, context) {
  var text = normalizeText(message);
  var topics = [];
  if (clinicalDomain && clinicalDomain.key) topics.push(clinicalDomain.key);
  if (/\btreino|musculacao|forca|cardio|fadiga|recuperacao\b/.test(text)) topics.push('treino');
  if (/\bdieta|nutricao|refeicao|proteina|caloria|macro|alimento\b/.test(text)) topics.push('dieta');
  if (/\bexame|laborator|biomarcador|glicose|colesterol|testosterona|tsh|ferritina\b/.test(text)) topics.push('exames');
  if (context && context.treino && context.treino.disponivel) topics.push('treino atual');
  if (context && context.dieta && context.dieta.disponivel) topics.push('plano alimentar atual');
  if (context && context.exames && context.exames.disponivel) topics.push('exames laboratoriais');
  return unique(topics).slice(0, 10);
}

function extractPathologies(context) {
  var clinical = context && context.contextoClinico;
  var user = context && context.user;
  return unique([]
    .concat(clinical && Array.isArray(clinical.patologias) ? clinical.patologias : [])
    .concat(user && user.patologia ? [user.patologia] : [])
    .concat(user && Array.isArray(user.patologias) ? user.patologias : []));
}

function buildPriorityFlags(context, pathologies, biomarkers) {
  var flags = [];
  var exames = context && context.exames;
  var treino = context && context.treino;
  if (pathologies.length) flags.push('patologia_obrigatoria');
  if (exames && exames.disponivel) flags.push('cruzar_exames');
  if (biomarkers.length) flags.push('biomarcadores_alterados');
  if (treino && treino.fatigueStatus && treino.fatigueStatus !== 'ok') flags.push('fadiga_treino');
  if (treino && treino.recoveryStatus && treino.recoveryStatus !== 'ok') flags.push('recuperacao_treino');
  return unique(flags);
}

async function buildClinicalEvidenceContext(input) {
  var options = input && typeof input === 'object' ? input : {};
  var context = options.kronosContext || options.context || {};
  var message = String(options.message || options.userMessage || '');
  var clinicalDomain = options.clinicalDomain || domainResolver.resolveKronosClinicalDomain({
    topic: options.topic,
    intent: options.intent,
    message: message
  });
  var pathologies = extractPathologies(context);
  var biomarkers = extractBiomarkers(context);
  var topics = extractTopics(message, clinicalDomain, context);
  var evidence = await evidenceRepository.searchClinicalEvidence({
    domain: clinicalDomain.key,
    topic: topics,
    patologia: pathologies,
    biomarcador: biomarkers
  }, { limit: 8 });

  return {
    domain: clinicalDomain,
    evidenceAvailable: !!(evidence.sources && evidence.sources.length),
    topics: topics,
    sources: evidence.sources || [],
    clinicalFocus: {
      patologia: pathologies,
      biomarcadoresAlterados: biomarkers,
      usarTreinoReal: !!(context.treino && context.treino.disponivel),
      usarDietaReal: !!(context.dieta && context.dieta.disponivel),
      usarExamesReais: !!(context.exames && context.exames.disponivel)
    },
    priorityFlags: buildPriorityFlags(context, pathologies, biomarkers),
    repository: {
      sourceTable: evidence.sourceTable || null,
      error: evidence.error || null
    }
  };
}

module.exports = {
  buildClinicalEvidenceContext: buildClinicalEvidenceContext
};
