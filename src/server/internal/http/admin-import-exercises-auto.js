function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];

  if (!expected || !provided || provided !== expected) {
    return false;
  }

  return true;
}

function isAutoImportEnabled() {
  var value = process.env.AUTO_IMPORT_EXERCISES;
  return value === 'true' || value === '1';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      status: 'method_not_allowed',
      message: 'method not allowed; use POST'
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      status: 'unauthorized',
      message: 'unauthorized'
    });
  }

  if (!isAutoImportEnabled()) {
    return res.status(403).json({
      ok: false,
      status: 'disabled',
      message: 'disabled'
    });
  }

  return res.status(200).json({
    ok: true,
    status: 'ready'
  });
};
