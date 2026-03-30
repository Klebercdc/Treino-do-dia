function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseEmailList(raw) {
  return String(raw || '')
    .split(',')
    .map(function(item) { return normalizeEmail(item); })
    .filter(Boolean);
}

function getPrivilegedEmails() {
  var fromAdmin = parseEmailList(process.env.ADMIN_EMAILS);
  var fromDev = parseEmailList(process.env.DEV_EMAILS);
  var unique = {};
  fromAdmin.concat(fromDev).forEach(function(email) { unique[email] = true; });
  var emails = Object.keys(unique);

  // Fallback local opcional apenas fora de produção.
  if (!emails.length && process.env.NODE_ENV !== 'production') {
    var localFallback = parseEmailList(process.env.LOCAL_ADMIN_EMAILS);
    localFallback.forEach(function(email) { unique[email] = true; });
    emails = Object.keys(unique);
  }

  return emails;
}

function isPrivilegedEmail(email) {
  var normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getPrivilegedEmails().indexOf(normalized) >= 0;
}

function getRequestUserEmail(req, userOrEmail) {
  if (typeof userOrEmail === 'string') return normalizeEmail(userOrEmail);
  if (userOrEmail && typeof userOrEmail === 'object') {
    return normalizeEmail(userOrEmail.email);
  }
  if (req && req.authUser && req.authUser.email) return normalizeEmail(req.authUser.email);
  return '';
}

function buildAccessProfile(userOrEmail) {
  var email = getRequestUserEmail(null, userOrEmail);
  var isAuthenticated = !!email;
  var isPrivileged = isPrivilegedEmail(email);
  var source = isPrivileged ? 'env_whitelist' : (isAuthenticated ? 'authenticated_user' : 'anonymous');

  return {
    email: email,
    isAuthenticated: isAuthenticated,
    isAdmin: isPrivileged,
    isDeveloper: isPrivileged,
    canBypassQuota: isPrivileged,
    canSeeDevTools: isPrivileged,
    canSeeAdminUI: isPrivileged,
    canSeeTestFeatures: isPrivileged,
    source: source
  };
}

function canBypassQuota(accessProfile) {
  return !!(accessProfile && accessProfile.canBypassQuota);
}

function canAccessAdminFeatures(accessProfile) {
  return !!(accessProfile && accessProfile.canSeeAdminUI);
}

function canAccessDevFeatures(accessProfile) {
  return !!(accessProfile && accessProfile.canSeeDevTools);
}

function canAccessTestFeatures(accessProfile) {
  return !!(accessProfile && accessProfile.canSeeTestFeatures);
}

module.exports = {
  getPrivilegedEmails: getPrivilegedEmails,
  normalizeEmail: normalizeEmail,
  isPrivilegedEmail: isPrivilegedEmail,
  getRequestUserEmail: getRequestUserEmail,
  buildAccessProfile: buildAccessProfile,
  canBypassQuota: canBypassQuota,
  canAccessAdminFeatures: canAccessAdminFeatures,
  canAccessDevFeatures: canAccessDevFeatures,
  canAccessTestFeatures: canAccessTestFeatures
};
