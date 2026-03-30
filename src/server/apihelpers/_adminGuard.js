var access = require('./_access');

function resolveAccessProfile(user) {
  return access.buildAccessProfile(user || null);
}

function requireAdmin(user, res) {
  var profile = resolveAccessProfile(user);
  if (!profile.isAdmin) {
    if (res) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Acesso administrativo necessário.'
        }
      });
    }
    return null;
  }
  return profile;
}

module.exports = {
  resolveAccessProfile: resolveAccessProfile,
  requireAdmin: requireAdmin
};
