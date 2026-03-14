var https = require('https');

/**
 * Realiza uma chamada HTTP para a API NVIDIA com retry e backoff exponencial.
 * @param {object} options - { hostname, path, method, headers }
 * @param {string} body - corpo da requisição
 * @param {number} timeoutMs - timeout por tentativa
 * @param {number} maxRetries - número máximo de tentativas (padrão: 3)
 * @param {function} callback - function(err, text)
 */
function callNvidiaRaw(options, body, timeoutMs, maxRetries, callback) {
  var attempts = 0;
  var delays = [1000, 2000, 4000];

  function attempt() {
    attempts++;
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var status = res.statusCode;
        // Retry em erros transitórios do servidor
        if ((status === 429 || status >= 500) && attempts <= maxRetries) {
          var wait = delays[attempts - 1] || 4000;
          return setTimeout(attempt, wait);
        }
        if (status >= 400) {
          return callback('HTTP ' + status + ': ' + data.substring(0, 200), null);
        }
        try {
          var j = JSON.parse(data);
          var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
          callback(null, text);
        } catch (e) {
          callback('JSON parse error: ' + e.message, null);
        }
      });
    });

    req.on('error', function(e) {
      if (attempts <= maxRetries) {
        var wait = delays[attempts - 1] || 4000;
        return setTimeout(attempt, wait);
      }
      callback(e.message, null);
    });

    req.setTimeout(timeoutMs, function() {
      req.destroy(new Error('timeout'));
      if (attempts <= maxRetries) {
        var wait = delays[attempts - 1] || 4000;
        return setTimeout(attempt, wait);
      }
      callback('timeout após ' + timeoutMs + 'ms (' + attempts + ' tentativas)', null);
    });

    req.write(body);
    req.end();
  }

  attempt();
}

/**
 * Chama a API NVIDIA com retry automático.
 * @param {string} KEY - NVIDIA API Key
 * @param {object} payload - corpo da requisição (será serializado para JSON)
 * @param {number} timeoutMs - timeout por tentativa
 * @param {number} maxRetries - número máximo de retentativas (padrão: 3)
 * @param {function} callback - function(err, text)
 */
function callNvidia(KEY, payload, timeoutMs, maxRetries, callback) {
  var body = JSON.stringify(payload);
  var options = {
    hostname: 'integrate.api.nvidia.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + KEY,
      'Content-Length': Buffer.byteLength(body)
    }
  };
  callNvidiaRaw(options, body, timeoutMs, maxRetries, callback);
}

/**
 * Chama a API NVIDIA com suporte a tool calls e retry.
 * Retorna o objeto `message` completo (com tool_calls se houver).
 */
function callNvidiaAgent(KEY, payload, timeoutMs, maxRetries, callback) {
  var body = JSON.stringify(payload);
  var options = {
    hostname: 'integrate.api.nvidia.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + KEY,
      'Content-Length': Buffer.byteLength(body)
    }
  };
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
          var wait = delays[attempts - 1] || 4000;
          return setTimeout(attempt, wait);
        }
        if (status >= 400) {
          return callback('HTTP ' + status + ': ' + data.substring(0, 200), null);
        }
        try {
          var j = JSON.parse(data);
          var msg = j.choices && j.choices[0] && j.choices[0].message;
          callback(null, msg || { content: '' });
        } catch (e) {
          callback('JSON parse error: ' + e.message, null);
        }
      });
    });

    req.on('error', function(e) {
      if (attempts <= maxRetries) {
        var wait = delays[attempts - 1] || 4000;
        return setTimeout(attempt, wait);
      }
      callback(e.message, null);
    });

    req.setTimeout(timeoutMs, function() {
      req.destroy(new Error('timeout'));
      if (attempts <= maxRetries) {
        var wait = delays[attempts - 1] || 4000;
        return setTimeout(attempt, wait);
      }
      callback('timeout após ' + timeoutMs + 'ms (' + attempts + ' tentativas)', null);
    });

    req.write(body);
    req.end();
  }

  attempt();
}

module.exports = { callNvidia: callNvidia, callNvidiaAgent: callNvidiaAgent };
