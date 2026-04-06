var https = require('https');

function readSupabaseUrl() {
  return process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || '';
}

function readSupabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    || '';
}

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
  if (!emails.length && process.env.NODE_ENV !== 'production') {
    parseEmailList(process.env.LOCAL_ADMIN_EMAILS).forEach(function(email) { unique[email] = true; });
    emails = Object.keys(unique);
  }
  return emails;
}

function isPrivilegedEmail(email) {
  var normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getPrivilegedEmails().indexOf(normalized) >= 0;
}

function resolveClaimAdmin(userOrEmail) {
  var user = userOrEmail && typeof userOrEmail === 'object' ? userOrEmail : null;
  if (!user) return false;
  var appRole = String((user.app_metadata && (user.app_metadata.role || user.app_metadata.app_role)) || '').toLowerCase();
  var custom = user.app_metadata && user.app_metadata.is_admin;
  return appRole === 'admin' || appRole === 'owner' || custom === true;
}

function getRequestUserEmail(req, userOrEmail) {
  if (typeof userOrEmail === 'string') return normalizeEmail(userOrEmail);
  if (userOrEmail && typeof userOrEmail === 'object') return normalizeEmail(userOrEmail.email);
  if (req && req.authUser && req.authUser.email) return normalizeEmail(req.authUser.email);
  return '';
}

function buildAccessProfile(userOrEmail, options) {
  var email = getRequestUserEmail(null, userOrEmail);
  var isAuthenticated = !!email;
  var fromWhitelist = isPrivilegedEmail(email);
  var fromClaims = resolveClaimAdmin(userOrEmail);
  var fromProfile = !!(options && options.profileIsAdmin === true);
  var hasProfileDecision = !!(options && options.profileLookupPerformed === true);
  var isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  var allowWhitelistOverride = fromWhitelist && !isProduction;

  var isAdmin;
  var source;

  if (hasProfileDecision) {
    if (fromProfile) {
      isAdmin = true;
      source = 'profiles_table';
    } else if (allowWhitelistOverride) {
      isAdmin = true;
      source = 'env_whitelist_override';
    } else {
      isAdmin = false;
      source = 'profiles_table';
    }
  } else if (allowWhitelistOverride) {
    isAdmin = true;
    source = 'env_whitelist';
  } else {
    isAdmin = false;
    source = isAuthenticated ? 'awaiting_profiles_resolution' : 'anonymous';
  }

  var profile = {
    email: email,
    isAuthenticated: isAuthenticated,
    isAdmin: isAdmin,
    isDeveloper: isAdmin,
    canBypassQuota: isAdmin,
    canSeeDevTools: isAdmin,
    canSeeAdminUI: isAdmin,
    canSeeTestFeatures: isAdmin,
    source: source,
    profileIsAdmin: fromProfile,
    claimIsAdmin: fromClaims,
    envWhitelistIsAdmin: fromWhitelist,
    profileLookupPerformed: hasProfileDecision
  };

  logAccessDecision('access_profile_resolved', {
    user_email: email || null,
    is_admin: profile.isAdmin,
    source_of_admin_resolution: source,
    profile_lookup_performed: hasProfileDecision,
    profile_is_admin: fromProfile,
    claim_is_admin: fromClaims,
    env_whitelist_is_admin: fromWhitelist,
    reason: hasProfileDecision ? 'profiles_lookup_completed' : 'profiles_lookup_pending'
  });

  return profile;
}

function logAccessDecision(event, payload) {
  try {
    var body = Object.assign({
      at: new Date().toISOString(),
      event: event || 'access_decision'
    }, payload || {});
    console.info('[kronia.access]', JSON.stringify(body));
  } catch (_) {}
}

function supabaseProfileAdminLookup(userId, callback) {
  var url = readSupabaseUrl();
  var key = readSupabaseServiceKey();
  if (!url || !key || !userId) return callback(null, null);

  var hostname = url.replace('https://', '').replace('http://', '').split('/')[0];
  var path = '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&select=is_admin&limit=1';
  var req = https.request({
    hostname: hostname,
    path: path,
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    }
  }, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      if (res.statusCode >= 400) return callback(null, null);
      try {
        var rows = JSON.parse(data || '[]');
        var row = Array.isArray(rows) ? rows[0] : null;
        callback(null, row ? row.is_admin === true : null);
      } catch (_) {
        callback(null, null);
      }
    });
  });
  req.on('error', function() { callback(null, null); });
  req.setTimeout(5000, function() { req.destroy(); });
  req.end();
}

function buildAccessProfileWithDb(user, callback) {
  if (!user || !user.id) return callback(null, buildAccessProfile(user, { profileLookupPerformed: true, profileIsAdmin: false }));
  supabaseProfileAdminLookup(user.id, function(_err, isAdminFromProfile) {
    callback(null, buildAccessProfile(user, {
      profileIsAdmin: isAdminFromProfile === true,
      profileLookupPerformed: true
    }));
  });
}

function canBypassQuota(accessProfile) { return !!(accessProfile && accessProfile.canBypassQuota); }
function canAccessAdminFeatures(accessProfile) { return !!(accessProfile && accessProfile.canSeeAdminUI); }
function canAccessDevFeatures(accessProfile) { return !!(accessProfile && accessProfile.canSeeDevTools); }
function canAccessTestFeatures(accessProfile) { return !!(accessProfile && accessProfile.canSeeTestFeatures); }

module.exports = {
  getPrivilegedEmails: getPrivilegedEmails,
  normalizeEmail: normalizeEmail,
  isPrivilegedEmail: isPrivilegedEmail,
  getRequestUserEmail: getRequestUserEmail,
  buildAccessProfile: buildAccessProfile,
  buildAccessProfileWithDb: buildAccessProfileWithDb,
  canBypassQuota: canBypassQuota,
  canAccessAdminFeatures: canAccessAdminFeatures,
  canAccessDevFeatures: canAccessDevFeatures,
  canAccessTestFeatures: canAccessTestFeatures
};