/**
 * Helper para a API Gemini via endpoint compatível com OpenAI.
 * Modelo padrão: gemini-2.0-flash
 *
 * Variável de ambiente necessária (Vercel):
 *   GEMINI_API_KEY = chave do Google AI Studio
 */

var https = require('https');

var GEMINI_MODEL = 'gemini-2.0-flash';

function makeOptions(KEY, body) {
  return {
    options: {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/openai/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    },
    body: body
  };
}

function withRetry(options, body, timeoutMs, maxRetries, onData, callback) {
  var attempts = 0;
  var delays = [1000, 2000, 4000];

  function attempt() {
    attempts++;
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var status = res.statusCode;
        if ((status === 429 || status >= 500) && attempts <= maxRetries) {
          return setTimeout(attempt, delays[attempts - 1] || 4000);
        }
        if (status >= 400) {
          return callback('HTTP ' + status + ': ' + data.substring(0, 300), null);
        }
        try {
          var j = JSON.parse(data);
          callback(null, onData(j));
        } catch (e) {
          callback('JSON parse error: ' + e.message, null);
        }
      });
    });

    req.on('error', function(e) {
      if (attempts <= maxRetries) return setTimeout(attempt, delays[attempts - 1] || 4000);
      callback(e.message, null);
    });

    req.setTimeout(timeoutMs, function() {
      req.destroy(new Error('timeout'));
      if (attempts <= maxRetries) return setTimeout(attempt, delays[attempts - 1] || 4000);
      callback('timeout após ' + timeoutMs + 'ms (' + attempts + ' tentativas)', null);
    });

    req.write(body);
    req.end();
  }

  attempt();
}

/** Chamada simples — retorna texto da resposta */
function callGemini(KEY, payload, timeoutMs, maxRetries, callback) {
  payload.model = payload.model || GEMINI_MODEL;
  var body = JSON.stringify(payload);
  var r = makeOptions(KEY, body);
  withRetry(r.options, r.body, timeoutMs, maxRetries, function(j) {
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  }, callback);
}

/** Chamada com suporte a tool calls — retorna o objeto message completo */
function callGeminiAgent(KEY, payload, timeoutMs, maxRetries, callback) {
  payload.model = payload.model || GEMINI_MODEL;
  var body = JSON.stringify(payload);
  var r = makeOptions(KEY, body);
  withRetry(r.options, r.body, timeoutMs, maxRetries, function(j) {
    return (j.choices && j.choices[0] && j.choices[0].message) || { content: '' };
  }, callback);
}

/** Chamada com retorno de uso de tokens */
function callGeminiFull(KEY, payload, timeoutMs, maxRetries, callback) {
  payload.model = payload.model || GEMINI_MODEL;
  var body = JSON.stringify(payload);
  var r = makeOptions(KEY, body);
  withRetry(r.options, r.body, timeoutMs, maxRetries, function(j) {
    var text  = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    var usage = j.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return { text: text, usage: usage, model: payload.model };
  }, callback);
}

module.exports = { callGemini: callGemini, callGeminiAgent: callGeminiAgent, callGeminiFull: callGeminiFull };
