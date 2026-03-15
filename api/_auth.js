/**
 * Helper de autenticação — verifica o JWT do Supabase.
 * Usa a API REST do Supabase (sem dependência extra).
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SUPABASE_URL      = https://twxoddzogbmaysebhour.supabase.co
 *   SUPABASE_ANON_KEY = eyJ... (chave pública anon)
 */

var https = require('https');

var SUPABASE_URL      = process.env.SUPABASE_URL      || 'https://twxoddzogbmaysebhour.supabase.co';
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Verifica o access_token do usuário chamando a API do Supabase.
 * @param {string} token - Bearer token do header Authorization
 * @param {function} callback - function(err, user)
 */
function verifyToken(token, callback) {
  if (!token) return callback('Token ausente', null);
  if (!SUPABASE_ANON_KEY) return callback('SUPABASE_ANON_KEY não configurada', null);

  var hostname = SUPABASE_URL.replace('https://', '');
  var options = {
    hostname: hostname,
    path: '/auth/v1/user',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'apikey': SUPABASE_ANON_KEY
    }
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      if (res.statusCode === 200) {
        try {
          var user = JSON.parse(data);
          callback(null, user);
        } catch (e) {
          callback('Resposta inválida do Supabase', null);
        }
      } else {
        callback('Não autorizado', null);
      }
    });
  });

  req.setTimeout(5000, function() {
    req.destroy();
    callback('Timeout na verificação de token', null);
  });

  req.on('error', function(e) { callback(e.message, null); });
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
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }
    next(user);
  });
}

module.exports = { requireAuth: requireAuth, verifyToken: verifyToken };
