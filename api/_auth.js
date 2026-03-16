/**
 * Helper de autenticação — verifica o JWT do Supabase via endpoint /auth/v1/user.
 *
 * Variáveis de ambiente (Vercel) — ao menos uma deve estar configurada:
 *   SUPABASE_SERVICE_KEY = chave service_role do projeto Supabase (preferencial)
 *   SUPABASE_ANON_KEY    = chave anon/public (suficiente para validar tokens)
 *   SUPABASE_URL         = https://twxoddzogbmaysebhour.supabase.co
 */

var https = require('https');

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://twxoddzogbmaysebhour.supabase.co';

// Anon key é pública (já está no frontend) — usada como fallback seguro
var SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E';

/**
 * Verifica o JWT do Supabase delegando ao endpoint /auth/v1/user.
 * Funciona com qualquer algoritmo (HS256, RS256, etc.) sem depender
 * do SUPABASE_JWT_SECRET nem de bibliotecas externas de JWT.
 */
function verifyToken(token, callback) {
  if (!token) return callback('Token ausente', null);

  var apiKey = process.env.SUPABASE_SERVICE_KEY
             || process.env.SUPABASE_ANON_KEY
             || SUPABASE_ANON_KEY_FALLBACK;

  var baseUrl = SUPABASE_URL.replace(/\/$/, '');
  var urlObj = new URL(baseUrl + '/auth/v1/user');

  var options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'apikey': apiKey
    }
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      if (res.statusCode === 200) {
        try {
          var userObj = JSON.parse(data);
          callback(null, {
            id:    userObj.id,
            email: userObj.email,
            role:  userObj.role
          });
        } catch (e) {
          callback('Erro ao processar resposta do Supabase', null);
        }
      } else {
        callback('Token inválido', null);
      }
    });
  });

  req.on('error', function(e) {
    callback('Erro de conexão com Supabase: ' + e.message, null);
  });

  req.end();
}

/**
 * Middleware que extrai e verifica o token do header Authorization.
 * Uso: requireAuth(req, res, function(user) { ... });
 */
function requireAuth(req, res, next) {
  var authHeader = req.headers['authorization'] || '';
  var token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Autenticação necessária' });
    return;
  }

  verifyToken(token, function(err, user) {
    if (err || !user) {
      res.status(401).json({ error: err || 'Token inválido' });
      return;
    }
    next(user);
  });
}

module.exports = { requireAuth: requireAuth, verifyToken: verifyToken };
