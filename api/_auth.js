/**
 * Helper de autenticação — verifica o JWT do Supabase com assinatura HMAC.
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SUPABASE_URL       = https://twxoddzogbmaysebhour.supabase.co
 *   SUPABASE_JWT_SECRET = <JWT secret do projeto Supabase>
 */

var jwt = require('jsonwebtoken');

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://twxoddzogbmaysebhour.supabase.co';
var EXPECTED_ISSUER = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1';

/**
 * Verifica o JWT do Supabase com validação de assinatura HMAC-SHA256.
 * Checa: assinatura, issuer, audience, expiração.
 */
function verifyToken(token, callback) {
  if (!token) return callback('Token ausente', null);

  var secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return callback('SUPABASE_JWT_SECRET não configurado', null);

  var options = {
    algorithms: ['HS256'],
    issuer: EXPECTED_ISSUER,
    audience: 'authenticated'
  };

  jwt.verify(token, secret, options, function(err, payload) {
    if (err) {
      return callback('Token inválido: ' + err.message, null);
    }

    var user = {
      id:    payload.sub,
      email: payload.email,
      role:  payload.role
    };

    callback(null, user);
  });
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
