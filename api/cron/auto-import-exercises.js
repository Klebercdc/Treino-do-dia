var autoImportHandler = require('../admin-import-exercises-auto');

function isAuthorizedCron(req) {
  var expected = process.env.CRON_IMPORT_SECRET;
  var provided = req.headers['x-cron-secret'] || req.headers['cron-secret'] || '';
  return Boolean(expected && provided && provided === expected);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      ok: false,
      status: 'method_not_allowed',
      message: 'method not allowed; use GET or POST'
    });
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({
      ok: false,
      status: 'unauthorized',
      message: 'unauthorized'
    });
  }

  if (!process.env.IMPORT_ADMIN_KEY) {
    return res.status(500).json({
      ok: false,
      status: 'misconfigured',
      message: 'import admin key not configured'
    });
  }

  var delegatedReq = {
    method: 'POST',
    headers: Object.assign({}, req.headers, {
      'x-admin-key': process.env.IMPORT_ADMIN_KEY
    }),
    query: req.query || {},
    body: req.body || {}
  };

  return autoImportHandler(delegatedReq, res);
};
