/**
 * Rate limiter distribuído (Upstash Redis via REST) com fallback local controlado.
 */

var store = Object.create(null);
var MAX_STORE_SIZE = 10000;
var UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
var UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
var RL_PREFIX = process.env.RATE_LIMIT_PREFIX || 'kronia:ratelimit';

setInterval(function() {
  var now = Date.now();
  Object.keys(store).forEach(function(key) {
    if (store[key].resetAt < now) delete store[key];
  });
}, 5 * 60 * 1000).unref();

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

function checkRateLimitLocal(req, opts, userId) {
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
    key: key,
    backend: 'local-memory'
  };
}

function safeRedisKey(key) {
  return key.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function fetchJson(url, options) {
  return fetch(url, options).then(function(resp) {
    if (!resp.ok) {
      return resp.text().then(function(text) {
        throw new Error('Upstash HTTP ' + resp.status + ': ' + text);
      });
    }
    return resp.json();
  });
}

function checkRateLimitRemote(req, opts, userId) {
  var max = (opts && opts.max) || 60;
  var windowMs = (opts && opts.windowMs) || 60 * 1000;
  var category = (opts && opts.category) || 'default';
  var now = Date.now();
  var identity = userId ? ('u:' + userId) : ('ip:' + getIp(req));
  var key = RL_PREFIX + ':' + safeRedisKey(identity + ':c:' + category);
  var ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  var pipelineUrl = UPSTASH_URL.replace(/\/$/, '') + '/pipeline';
  var headers = {
    'Authorization': 'Bearer ' + UPSTASH_TOKEN,
    'Content-Type': 'application/json'
  };

  return fetchJson(pipelineUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, ttlSec, 'NX'],
      ['TTL', key]
    ])
  }).then(function(result) {
    var count = Number(result && result[0] && result[0].result) || 0;
    var ttl = Number(result && result[2] && result[2].result);
    if (!Number.isFinite(ttl) || ttl < 0) ttl = ttlSec;
    var resetAt = now + (ttl * 1000);
    return {
      allowed: count <= max,
      limit: max,
      remaining: Math.max(0, max - count),
      resetAt: resetAt,
      retryAfterSec: Math.max(1, ttl),
      category: category,
      key: key,
      backend: 'upstash-redis'
    };
  });
}

function checkRateLimit(req, opts, userId) {
  var strictRemote = !!(opts && opts.strictRemote);
  if (UPSTASH_URL && UPSTASH_TOKEN && typeof fetch === 'function') {
    return checkRateLimitRemote(req, opts, userId)
      .catch(function(err) {
        if (strictRemote) throw err;
        var fallback = checkRateLimitLocal(req, opts, userId);
        fallback.fallback = true;
        fallback.fallbackReason = err && err.message ? err.message : String(err || 'unknown');
        return fallback;
      });
  }
  if (strictRemote) {
    return Promise.reject(new Error('RATE_LIMIT_REMOTE_REQUIRED_BUT_NOT_CONFIGURED'));
  }
  return Promise.resolve(checkRateLimitLocal(req, opts, userId));
}

function applyRateLimitHeaders(res, result) {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  res.setHeader('X-RateLimit-Backend', String(result.backend || 'local-memory'));
  if (result.fallback) res.setHeader('X-RateLimit-Fallback', '1');
}

function rateLimit(req, res, next, opts, userId) {
  Promise.resolve(checkRateLimit(req, opts, userId)).then(function(result) {
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
        meta: {
          category: result.category,
          retryAfterSec: result.retryAfterSec,
          backend: result.backend,
          fallback: !!result.fallback
        }
      });
      return;
    }
    next(result);
  }).catch(function(err) {
    res.status(503).json({
      ok: false,
      success: false,
      type: 'error',
      state: 'provider_unavailable',
      error: 'RATE_LIMIT_UNAVAILABLE',
      retryable: true,
      message: 'Não foi possível validar limite de requisições agora.',
      meta: { error: err && err.message ? err.message : String(err || 'unknown') }
    });
  });
}

module.exports = { rateLimit: rateLimit, checkRateLimit: checkRateLimit, applyRateLimitHeaders: applyRateLimitHeaders };
