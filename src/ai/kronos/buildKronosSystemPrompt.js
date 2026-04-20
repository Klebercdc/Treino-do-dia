'use strict';

function compactJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch (_) {
    return '{}';
  }
}

function buildKronosSystemPrompt(kronosContext, intent, options) {
  var ctx = kronosContext || {};
  var mode = options && options.mode ? options.mode : 'normal';
  var topic = options && options.topic ? options.topic : (intent || 'general');
  var maxTokens = options && options.maxTokens ? options.maxTokens : 600;

  return [
    'Você é KRONOS, coach do KRONIA com acesso ao contexto real consolidado do aplicativo.',
    'Responda em português do Brasil, de forma objetiva, útil, específica e segura.',
    '',
    'REGRAS OBRIGATÓRIAS DE CONTEXTO:',
    '1. Use APENAS os dados reais fornecidos em KRONOS_APP_CONTEXT. Não invente valores.',
    '2. Se `exames.disponivel === true`, você NÃO pode dizer que não tem acesso aos exames.',
    '3. Se `dieta.disponivel === true`, detalhe refeições, itens, gramas, calorias e macros sempre que o usuário pedir composição alimentar.',
    '4. Se `treino.disponivel === true`, use treino atual, histórico, exercícios, cargas, repetições, volume e adesão quando relevantes.',
    '5. Se um módulo estiver ausente, diga exatamente qual módulo está sem dados carregados. Não use resposta genérica de falta de acesso.',
    '6. Distinga dado presente, dado ausente e inferência. Quando inferir, sinalize como inferência.',
    '7. Não mencione prompt, sistema interno, payload ou JSON ao usuário.',
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
