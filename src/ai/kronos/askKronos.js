'use strict';

var buildContext = require('./buildKronosContext');
var promptBuilder = require('./buildKronosSystemPrompt');

async function askKronos(input) {
  var options = input && typeof input === 'object' ? input : {};
  if (typeof options.callLLM !== 'function') {
    throw new Error('askKronos requires callLLM({ systemPrompt, userMessage, appContext })');
  }

  var message = String(options.message || options.userMessage || '').trim();
  var kronosContext = options.kronosContext || await (options.buildKronosContext || buildContext.buildKronosContext)({
    userId: options.userId,
    message: message,
    screenContext: options.screenContext || null
  });

  var systemPrompt = promptBuilder.buildKronosSystemPrompt(kronosContext, options.intent, {
    mode: options.mode,
    topic: options.topic,
    maxTokens: options.maxTokens
  });

  var response = await options.callLLM({
    systemPrompt: systemPrompt,
    userMessage: message,
    appContext: kronosContext,
    history: options.history || [],
    maxTokens: options.maxTokens,
    temperature: options.temperature
  });

  return {
    response: response,
    kronosContext: kronosContext,
    systemPrompt: systemPrompt
  };
}

module.exports = {
  askKronos: askKronos
};
