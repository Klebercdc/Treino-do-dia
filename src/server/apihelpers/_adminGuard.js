var access = require('./_access');

function deny(res) {
  if (!res) return;
  res.status(403).json({
    success: false,
    error: {
      code: 'ADMIN_REQUIRED',
      message: 'Acesso administrativo necessário.'
    }
  });
}

function resolveAccessProfile(user) {
  return access.buildAccessProfile(user || null);
}

function resolveAccessProfileAsync(user, callback) {
  return access.buildAccessProfileWithDb(user || null, function(_err, profile) {
    callback(profile || resolveAccessProfile(user || null));
  });
}

function requireAdmin(user, res) {
  var profile = resolveAccessProfile(user);
  if (!profile.isAdmin) {
    deny(res);
    return null;
  }
  return profile;
}

function requireAdminAsync(user, res, callback) {
  return resolveAccessProfileAsync(user, function(profile) {
    if (!profile || !profile.isAdmin) {
      deny(res);
      return callback(null);
    }
    return callback(profile);
  });
}

module.exports = {
  resolveAccessProfile: resolveAccessProfile,
  resolveAccessProfileAsync: resolveAccessProfileAsync,
  requireAdmin: requireAdmin,
  requireAdminAsync: requireAdminAsync
};
