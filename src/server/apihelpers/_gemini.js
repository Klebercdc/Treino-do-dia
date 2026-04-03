/**
 * Helper para a API Groq (compatível com OpenAI).
 */

var https = require('https');

var GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
var RETRYABLE_STATUS = { 429: true, 502: true, 503: true, 504: true };
var RETRYABLE_NETWORK = { timeout: true, econnreset: true, etimedout: true, eai_again: true };
var RETRY_DELAYS_MS = [350, 900, 1800];

function isModelDeprecationError(status, rawBody) {
  if (status !== 400) return false;
  var body = String(rawBody || '').toLowerCase();
  return (
    body.indexOf('decommissioned') >= 0 ||
    body.indexOf('no longer supported') >= 0 ||
    (body.indexOf('model') >= 0 && body.indexOf('not found') >= 0)
  );
}

function sleep(ms, next) {
  return setTimeout(next, ms);
}

function makeOptions(KEY, body) {
  return {
    hostname: 'api.groq.com',
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + KEY,
      'Content-Length': Buffer.byteLength(body)
    }
  };
}

function isRetryableNetworkError(errMessage) {
  var text = String(errMessage || '').toLowerCase();
  return Object.keys(RETRYABLE_NETWORK).some(function(key) { return text.indexOf(key) >= 0; });
}

function executeRequest(KEY, payload, timeoutMs, callback) {
  var body = JSON.stringify(payload);
  var req = https.request(makeOptions(KEY, body), function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      callback(null, { status: res.statusCode, raw: data });
    });
  });

  req.on('error', function(e) { callback(e.message || 'network_error', null); });
  req.setTimeout(timeoutMs, function() { req.destroy(); callback('timeout', null); });
  req.write(body);
  req.end();
}

function tryModels(KEY, payload, timeoutMs, onData, callback) {
  var models = GROQ_MODELS.slice();
  var modelIndex = 0;

  function attemptModel() {
    if (modelIndex >= models.length) return callback('Cota Groq esgotada em todos os modelos', null);
    var selectedModel = models[modelIndex++];
    var attempt = 0;

    function tryOnce() {
      var currentPayload = Object.assign({}, payload, { model: selectedModel });
      executeRequest(KEY, currentPayload, timeoutMs, function(err, response) {
        if (err) {
          if (isRetryableNetworkError(err) && attempt < RETRY_DELAYS_MS.length) {
            return sleep(RETRY_DELAYS_MS[attempt++], tryOnce);
          }
          return attemptModel();
        }

        var status = Number(response.status || 0);
        var raw = response.raw || '';

        if (isModelDeprecationError(status, raw)) return attemptModel();

        if (RETRYABLE_STATUS[status]) {
          if (attempt < RETRY_DELAYS_MS.length) {
            return sleep(RETRY_DELAYS_MS[attempt++], tryOnce);
          }
          return attemptModel();
        }

        if (status >= 400) {
          return callback('HTTP ' + status + ': ' + String(raw).substring(0, 300), null);
        }

        try {
          callback(null, onData(JSON.parse(raw || '{}')));
        } catch (e) {
          callback('JSON parse error: ' + e.message, null);
        }
      });
    }

    tryOnce();
  }

  attemptModel();
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
    var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    var usage = j.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return { text: text, usage: usage, model: payload.model };
  }, callback);
}

function callGeminiStreamWithTools(KEY, payload, timeoutMs, onDelta, onDone, onError) {
  var models = GROQ_MODELS.slice();
  var idx = 0;

  function attempt() {
    if (idx >= models.length) return onError('Cota Groq esgotada em todos os modelos');
    var p = Object.assign({}, payload, { model: models[idx++], stream: true });
    var body = JSON.stringify(p);
    var opts = makeOptions(KEY, body);

    var toolCallsMap = {};
    var contentAccum = '';
    var buf = '';

    var req = https.request(opts, function(res) {
      if (RETRYABLE_STATUS[res.statusCode]) return attempt();
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
          } catch (_e) {}
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
