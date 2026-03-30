/**
 * Helper para a API Groq (compatível com OpenAI).
 * Modelos: llama-3.3-70b-versatile, llama-3.1-8b-instant
 *
 * Variável de ambiente necessária (Vercel):
 *   GROQ_API_KEY = chave do console.groq.com
 */

var https = require('https');

var GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

function isModelDeprecationError(status, rawBody) {
  if (status !== 400) return false;
  var body = String(rawBody || '').toLowerCase();
  return (
    body.indexOf('decommissioned') >= 0 ||
    body.indexOf('no longer supported') >= 0 ||
    body.indexOf('model') >= 0 && body.indexOf('not found') >= 0
  );
}

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
        if (status === 429 || status === 503 || isModelDeprecationError(status, data)) return attempt();
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

// Streaming call with tool_calls support (SSE from Groq)
// onDelta({content}) called for each text chunk
// onDone(toolCalls, contentAccum) called when stream ends
// onError(err) called on error
function callGeminiStreamWithTools(KEY, payload, timeoutMs, onDelta, onDone, onError) {
  var models = GROQ_MODELS.slice();
  var idx = 0;

  function attempt() {
    if (idx >= models.length) return onError('Cota Groq esgotada em todos os modelos');
    var p = Object.assign({}, payload, { model: models[idx++], stream: true });
    var body = JSON.stringify(p);
    var opts = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    var toolCallsMap = {};
    var contentAccum = '';
    var buf = '';

    var req = https.request(opts, function(res) {
      if (res.statusCode === 429 || res.statusCode === 503) return attempt();
      if (res.statusCode >= 400) {
        var e = '';
        res.on('data', function(c) { e += c; });
        res.on('end', function() {
          if (isModelDeprecationError(res.statusCode, e)) return attempt();
          onError('HTTP ' + res.statusCode + ': ' + e.substring(0, 300));
        });
        return;
      }

      res.on('data', function(chunk) {
        buf += chunk.toString();
        var lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(function(line) {
          if (!line.startsWith('data: ')) return;
          var d = line.slice(6).trim();
          if (d === '[DONE]') return;
          try {
            var j = JSON.parse(d);
            var delta = j.choices && j.choices[0] && j.choices[0].delta;
            if (!delta) return;
            if (delta.content) {
              contentAccum += delta.content;
              onDelta({ content: delta.content });
            }
            if (delta.tool_calls) {
              delta.tool_calls.forEach(function(tc) {
                var i = typeof tc.index === 'number' ? tc.index : 0;
                if (!toolCallsMap[i]) toolCallsMap[i] = { id: '', function: { name: '', arguments: '' } };
                if (tc.id) toolCallsMap[i].id = tc.id;
                if (tc.function) {
                  if (tc.function.name) toolCallsMap[i].function.name += tc.function.name;
                  if (tc.function.arguments) toolCallsMap[i].function.arguments += tc.function.arguments;
                }
              });
            }
          } catch (e) {}
        });
      });

      res.on('end', function() {
        var toolCalls = Object.keys(toolCallsMap).sort(function(a, b) { return a - b; })
          .map(function(k) { return toolCallsMap[k]; })
          .filter(function(tc) { return tc.id && tc.function && tc.function.name; });
        onDone(toolCalls, contentAccum);
      });

      res.on('error', function(e) { onError(e.message); });
    });

    req.on('error', function(e) { onError(e.message); });
    req.setTimeout(timeoutMs, function() { req.destroy(); onError('timeout'); });
    req.write(body);
    req.end();
  }

  attempt();
}

module.exports = { callGemini: callGemini, callGeminiAgent: callGeminiAgent, callGeminiFull: callGeminiFull, callGeminiStreamWithTools: callGeminiStreamWithTools };
