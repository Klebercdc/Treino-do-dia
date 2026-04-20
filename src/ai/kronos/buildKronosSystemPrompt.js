'use strict';

function compactJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch (_) {
    return '{}';
  }
}

function uniqueValues(values) {
  var seen = Object.create(null);
  return (values || []).filter(function (value) {
    var clean = String(value || '').trim();
    var key = clean.toLowerCase();
    if (!clean || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function buildKronosSystemPrompt(kronosContext, intent, options) {
  var ctx = kronosContext || {};
  var mode = options && options.mode ? options.mode : 'normal';
  var topic = options && options.topic ? options.topic : (intent || 'general');
  var maxTokens = options && options.maxTokens ? options.maxTokens : 600;
  var clinicalDomain = (options && options.clinicalDomain) || ctx.clinicalDomain || {};
  var clinicalEvidenceContext = (options && options.clinicalEvidenceContext) || ctx.clinicalEvidenceContext || {};
  var clinicalGuardrails = (options && options.clinicalGuardrails) || ctx.clinicalGuardrails || {};
  var patologias = uniqueValues((ctx.contextoClinico && Array.isArray(ctx.contextoClinico.patologias) ? ctx.contextoClinico.patologias : [])
    .concat(ctx.user && ctx.user.patologia ? [ctx.user.patologia] : [])
    .concat(ctx.user && Array.isArray(ctx.user.patologias) ? ctx.user.patologias : []));
  var patologiaObrigatoria = patologias.length ? patologias.join(', ') : 'não informada no perfil';

  return [
    'Você é KRONOS, sistema clínico-esportivo do KRONIA com acesso ao contexto real consolidado do aplicativo.',
    'Responda em português do Brasil, de forma objetiva, útil, específica, segura e baseada nos dados reais disponíveis.',
    'PAPEL CLÍNICO DO DOMÍNIO: ' + (clinicalGuardrails.physicianRole || clinicalDomain.physicianRole || 'abordagem clínica integrada'),
    'PATOLOGIA OBRIGATÓRIA DO USUÁRIO: ' + patologiaObrigatoria,
    '',
    'REGRAS OBRIGATÓRIAS DE CONTEXTO:',
    '1. Use APENAS os dados reais fornecidos em KRONOS_APP_CONTEXT. Não invente valores.',
    '2. Se `exames.disponivel === true`, você NÃO pode dizer que não tem acesso aos exames; use os alertas, impactos e resumo clínico fornecidos.',
    '3. Se `dieta.disponivel === true`, detalhe refeições, itens, gramas, calorias e macros sempre que o usuário pedir composição alimentar.',
    '4. Se `treino.disponivel === true`, use treino atual, histórico, exercícios, cargas, repetições, volume e adesão quando relevantes.',
    '5. Se um módulo estiver ausente, diga exatamente qual módulo está sem dados carregados. Não use resposta genérica de falta de acesso.',
    '6. Distinga dado presente, dado ausente e inferência. Quando inferir, sinalize como inferência.',
    '7. Não mencione prompt, sistema interno, payload ou JSON ao usuário.',
    '8. A patologia do usuário é uma RESTRIÇÃO obrigatória, não uma sugestão.',
    '9. A dieta deve respeitar a patologia, exames, treino e alimentos/gramas reais do plano atual; nunca monte dieta apenas para bater calorias.',
    '10. Nunca duplique alimentos sem justificativa clínica ou operacional clara.',
    '11. Sempre cruze exames + patologia + treino + dieta antes de responder, mesmo quando a pergunta parecer de um único domínio.',
    '12. Não responda de forma genérica: personalize pela evidência, biomarcadores, plano alimentar, treino e contexto clínico disponíveis.',
    '',
    'GUARDRAILS CLÍNICOS:',
    compactJson(clinicalGuardrails),
    '',
    'CONTEXTO DE EVIDÊNCIA CLÍNICA:',
    compactJson(clinicalEvidenceContext),
    '',
    'MODO: ' + mode,
    'TÓPICO/INTENÇÃO: ' + topic,
    'TETO DE TOKENS: ' + maxTokens,
    '',
    'KRONOS_APP_CONTEXT:',
    compactJson(ctx)
  ].join('\n');
}

module.exports = {
  buildKronosSystemPrompt: buildKronosSystemPrompt
};
