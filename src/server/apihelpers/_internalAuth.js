var crypto = require('crypto');

function readSecretFromReq(req) {
  var auth = req && req.headers ? String(req.headers['authorization'] || '') : '';
  if (auth.indexOf('Bearer ') === 0) return auth.slice(7).trim();
  var header = req && req.headers ? String(req.headers['x-internal-secret'] || req.headers['x-cron-secret'] || '') : '';
  if (header) return header.trim();
  return '';
}

function safeEquals(a, b) {
  try {
    var aa = Buffer.from(String(a || ''));
    var bb = Buffer.from(String(b || ''));
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch (_) {
    return false;
  }
}

function requireInternalAccess(req, res, next) {
  var expected = String(process.env.INTERNAL_WORKER_SECRET || process.env.CRON_SECRET || '').trim();
  if (!expected) {
    res.status(500).json({ ok: false, success: false, type: 'error', state: 'misconfigured', message: 'INTERNAL_WORKER_SECRET não configurado.', error: 'MISSING_INTERNAL_SECRET' });
    return;
  }

  var provided = readSecretFromReq(req);
  if (!provided || !safeEquals(provided, expected)) {
    res.status(401).json({ ok: false, success: false, type: 'error', state: 'unauthorized', message: 'Acesso interno não autorizado.', error: 'UNAUTHORIZED_INTERNAL' });
    return;
  }

  next();
}

module.exports = {
  requireInternalAccess: requireInternalAccess
};
