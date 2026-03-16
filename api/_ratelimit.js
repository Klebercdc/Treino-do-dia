/**
 * Rate limiter em memória por usuário (userId) ou IP como fallback.
 * Limita requisições por janela de tempo para proteger APIs de IA (custo).
 *
 * Uso: rateLimit(req, res, next, { max: 30, windowMs: 60000 })
 *      rateLimit(req, res, next, { max: 30, windowMs: 60000 }, 'user-uuid')
 */

var store = Object.create(null);

// Limpa entradas expiradas a cada 5 minutos
setInterval(function() {
  var now = Date.now();
  Object.keys(store).forEach(function(key) {
    if (store[key].resetAt < now) delete store[key];
  });
}, 5 * 60 * 1000);

function getIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    (req.connection && req.connection.remoteAddress) ||
    'unknown'
  ).toString().split(',')[0].trim();
}

/**
 * @param {object}   req
 * @param {object}   res
 * @param {function} next
 * @param {object}   opts    { max: number, windowMs: number }
 * @param {string}   [userId] - quando fornecido, usa userId como chave ao invés do IP
 */
function rateLimit(req, res, next, opts, userId) {
  var max      = (opts && opts.max)      || 60;
  var windowMs = (opts && opts.windowMs) || 60 * 1000;

  // Chave por usuário autenticado tem precedência sobre IP
  var key = userId ? 'u:' + userId : 'ip:' + getIp(req);
  var now = Date.now();

  if (!store[key] || store[key].resetAt < now) {
    store[key] = { count: 0, resetAt: now + windowMs };
  }

  store[key].count += 1;

  res.setHeader('X-RateLimit-Limit',     String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - store[key].count)));
  res.setHeader('X-RateLimit-Reset',     String(Math.ceil(store[key].resetAt / 1000)));

  if (store[key].count > max) {
    res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
    return;
  }

  next();
}

module.exports = { rateLimit: rateLimit };
