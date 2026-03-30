var cors = require('./_cors');
var auth = require('./_auth');
var access = require('./_access');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  return auth.requireAuth(req, res, function(user) {
    var profile = access.buildAccessProfile(user);
    return res.status(200).json({
      email: profile.email,
      isAdmin: profile.isAdmin,
      isDeveloper: profile.isDeveloper,
      canBypassQuota: profile.canBypassQuota,
      canSeeDevTools: profile.canSeeDevTools,
      canSeeAdminUI: profile.canSeeAdminUI,
      canSeeTestFeatures: profile.canSeeTestFeatures,
      source: profile.source
    });
  });
};
