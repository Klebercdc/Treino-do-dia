/**
 * Helper para a API Groq (compatível com OpenAI).
 * Modelos: llama-3.3-70b-versatile, llama-3.1-8b-instant, gemma2-9b-it
 *
 * Variável de ambiente necessária (Vercel):
 *   GROQ_API_KEY = chave do console.groq.com
 */

var https = require('https');

var GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];

function makeOptions(KEY, body) {
  return {
    options: {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
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

function tryModels(KEY, payload, timeoutMs, onData, callback) {
  var models = GROQ_MODELS.slice();
  var idx = 0;

  function attempt() {
    if (idx >= models.length) return callback('Cota Groq esgotada em todos os modelos', null);
    payload.model = models[idx++];
    var body = JSON.stringify(payload);
    var r = makeOptions(KEY, body);
    var req = https.request(r.options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var status = res.statusCode;
        if (status === 429 || status === 503) return attempt();
        if (status >= 400) return callback('HTTP ' + status + ': ' + data.substring(0, 300), null);
        try {
          callback(null, onData(JSON.parse(data)));
        } catch (e) {
          callback('JSON parse error: ' + e.message, null);
        }
      });
    });
    req.on('error', function(e) { callback(e.message, null); });
    req.setTimeout(timeoutMs, function() { req.destroy(); callback('timeout', null); });
    req.write(body);
    req.end();
  }

  attempt();
}

function callGemini(KEY, payload, timeoutMs, maxRetries, callback) {
  tryModels(KEY, payload, timeoutMs, function(j) {
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  }, callback);
}

function callGeminiAgent(KEY, payload, timeoutMs, maxRetries, callback) {
  tryModels(KEY, payload, timeoutMs, function(j) {
    return (j.choices && j.choices[0] && j.choices[0].message) || { content: '' };
  }, callback);
}

function callGeminiFull(KEY, payload, timeoutMs, maxRetries, callback) {
  tryModels(KEY, payload, timeoutMs, function(j) {
    var text  = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    var usage = j.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return { text: text, usage: usage, model: payload.model };
  }, callback);
}

module.exports = { callGemini: callGemini, callGeminiAgent: callGeminiAgent, callGeminiFull: callGeminiFull };
