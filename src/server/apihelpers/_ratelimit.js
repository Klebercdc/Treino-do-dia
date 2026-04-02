/**
 * Rate limiter em memória por usuário (userId) ou IP como fallback.
 */

var store = Object.create(null);
var MAX_STORE_SIZE = 10000;

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

function ensureBucket(key, windowMs) {
  var now = Date.now();
  if (!store[key] || store[key].resetAt < now) {
    if (!store[key] && Object.keys(store).length >= MAX_STORE_SIZE) {
      var oldest = Object.keys(store).reduce(function(a, b) {
        return store[a].resetAt < store[b].resetAt ? a : b;
      });
      delete store[oldest];
    }
    store[key] = { count: 0, resetAt: now + windowMs };
  }
  return store[key];
}

function checkRateLimit(req, opts, userId) {
  var max = (opts && opts.max) || 60;
  var windowMs = (opts && opts.windowMs) || 60 * 1000;
  var category = (opts && opts.category) || 'default';
  var now = Date.now();
  var identity = userId ? ('u:' + userId) : ('ip:' + getIp(req));
  var key = identity + ':c:' + category;
  var bucket = ensureBucket(key, windowMs);
  bucket.count += 1;

  return {
    allowed: bucket.count <= max,
    limit: max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    category: category,
    key: key
  };
}

function applyRateLimitHeaders(res, result) {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
}

function rateLimit(req, res, next, opts, userId) {
  var result = checkRateLimit(req, opts, userId);
  applyRateLimitHeaders(res, result);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    res.status(429).json({
      ok: false,
      success: false,
      type: 'error',
      state: 'rate_limited_temporary',
      error: 'RATE_LIMITED_TEMPORARY',
      errorCode: 'RATE_LIMITED_TEMPORARY',
      retryable: true,
      message: 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.',
      suggestion: 'Aguarde alguns segundos antes de enviar outra mensagem.',
      meta: { category: result.category, retryAfterSec: result.retryAfterSec }
    });
    return;
  }
  next(result);
}

module.exports = { rateLimit: rateLimit, checkRateLimit: checkRateLimit, applyRateLimitHeaders: applyRateLimitHeaders };
