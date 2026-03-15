/**
 * Helper de autenticação — verifica o JWT do Supabase localmente.
 * Decodifica o JWT e valida projeto + expiração sem chamada externa.
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SUPABASE_URL      = https://twxoddzogbmaysebhour.supabase.co
 *   SUPABASE_ANON_KEY = eyJ... (chave pública anon)
 */

var SUPABASE_PROJECT_REF = 'twxoddzogbmaysebhour';

/**
 * Decodifica e valida o JWT do Supabase localmente (sem chamada HTTP).
 * Verifica: formato, projeto correto, não expirado.
 */
function verifyToken(token, callback) {
  if (!token) return callback('Token ausente', null);

  try {
    var parts = token.split('.');
    if (parts.length !== 3) return callback('JWT inválido', null);

    // Decodifica payload (base64url → JSON)
    var payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );

    // Verifica se é do projeto correto
    if (payload.ref && payload.ref !== SUPABASE_PROJECT_REF) {
      return callback('Token de projeto inválido', null);
    }

    // Verifica expiração
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return callback('Token expirado', null);
    }

    // Retorna usuário com id e email
    var user = {
      id:    payload.sub,
      email: payload.email,
      role:  payload.role
    };

    callback(null, user);
  } catch (e) {
    callback('Erro ao decodificar token: ' + e.message, null);
  }
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
