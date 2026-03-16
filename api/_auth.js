/**
 * Helper de autenticação — verifica o JWT do Supabase via endpoint /auth/v1/user.
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SUPABASE_URL         = https://twxoddzogbmaysebhour.supabase.co
 *   SUPABASE_SERVICE_KEY = chave service_role do projeto Supabase
 */

var https = require('https');

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://twxoddzogbmaysebhour.supabase.co';

/**
 * Verifica o JWT do Supabase delegando ao endpoint /auth/v1/user.
 * Funciona com qualquer algoritmo (HS256, RS256, etc.) sem depender
 * do SUPABASE_JWT_SECRET nem de bibliotecas externas de JWT.
 */
function verifyToken(token, callback) {
  if (!token) return callback('Token ausente', null);

  var serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return callback('SUPABASE_SERVICE_KEY não configurado', null);

  var baseUrl = SUPABASE_URL.replace(/\/$/, '');
  var urlObj = new URL(baseUrl + '/auth/v1/user');

  var options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'apikey': serviceKey
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
