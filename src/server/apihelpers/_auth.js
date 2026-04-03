/**
 * Helper de autenticação — verifica o JWT do Supabase via endpoint /auth/v1/user.
 *
 * Variáveis de ambiente (Vercel) obrigatórias:
 *   SUPABASE_URL         = URL do projeto Supabase (ex: https://xyz.supabase.co)
 *   SUPABASE_SERVICE_KEY = chave service_role (preferencial) — NUNCA expor no frontend
 *   SUPABASE_ANON_KEY    = chave anon/public (fallback)
 *
 * Configure via: vercel env add SUPABASE_URL
 */

var https = require('https');

var SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error('[_auth] SUPABASE_URL não configurada. Adicione a variável de ambiente no Vercel.');
}

/**
 * Verifica o JWT do Supabase delegando ao endpoint /auth/v1/user.
 * Funciona com qualquer algoritmo (HS256, RS256, etc.) sem depender
 * do SUPABASE_JWT_SECRET nem de bibliotecas externas de JWT.
 */
function verifyToken(token, callback) {
  if (!token) return callback('Token ausente', null);

  var apiKey = process.env.SUPABASE_SERVICE_KEY
             || process.env.SUPABASE_SERVICE_ROLE_KEY
             || process.env.SUPABASE_ANON_KEY;

  var baseUrl = SUPABASE_URL.replace(/\/$/, '');
  var urlObj = new URL(baseUrl + '/auth/v1/user');

  var options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'GET',
    timeout: 7000,
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
            id: userObj.id,
            email: userObj.email,
            role: userObj.role,
            app_metadata: userObj.app_metadata || {},
            user_metadata: userObj.user_metadata || {},
            raw_user: userObj
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
  req.on('timeout', function() {
    req.destroy(new Error('timeout'));
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
    res.status(401).json({
      ok: false,
      success: false,
      type: 'error',
      state: 'unauthorized',
      error: 'UNAUTHORIZED',
      message: 'Autenticação necessária'
    });
    return;
  }

  verifyToken(token, function(err, user) {
    if (err || !user) {
      res.status(401).json({
        ok: false,
        success: false,
        type: 'error',
        state: 'unauthorized',
        error: 'UNAUTHORIZED',
        message: err || 'Token inválido'
      });
      return;
    }
    next(user);
  });
}

module.exports = { requireAuth: requireAuth, verifyToken: verifyToken };
