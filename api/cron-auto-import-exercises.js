var autoImport = require('./admin-import-exercises-auto');

function isCronAuthorized(req) {
  var secret = process.env.CRON_SECRET;
  if (!secret) return false;
  var auth = req.headers.authorization || req.headers.Authorization;
  return auth === 'Bearer ' + secret;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      status: 'method_not_allowed',
      message: 'method not allowed; use GET'
    });
  }

  if (!isCronAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      status: 'unauthorized',
      message: 'unauthorized'
    });
  }

  if (!(process.env.AUTO_IMPORT_EXERCISES === 'true' || process.env.AUTO_IMPORT_EXERCISES === '1')) {
    return res.status(403).json({
      ok: false,
      status: 'disabled',
      message: 'auto import disabled'
    });
  }

  try {
    var result = await autoImport.runAutoImportFlow({ requestedBy: 'cron-auto-endpoint' });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      status: 'failed',
      message: 'cron auto import failed'
    });
  }
};
