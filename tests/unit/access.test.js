const test = require('node:test');
const assert = require('node:assert/strict');

const access = require('../../src/server/apihelpers/_access');

test('buildAccessProfile is fail-closed before profiles lookup', () => {
  const profile = access.buildAccessProfile({
    email: 'ops@kronia.com',
    app_metadata: { role: 'admin' }
  });
  assert.equal(profile.isAdmin, false);
  assert.equal(profile.source, 'awaiting_profiles_resolution');
});

test('profiles.is_admin is canonical when profile lookup was performed', () => {
  const noAdmin = access.buildAccessProfile({
    email: 'member@kronia.com',
    app_metadata: { role: 'admin' }
  }, {
    profileIsAdmin: false,
    profileLookupPerformed: true
  });
  assert.equal(noAdmin.isAdmin, false);
  assert.equal(noAdmin.source, 'profiles_table');
  assert.equal(noAdmin.claimIsAdmin, true);

  const yesAdmin = access.buildAccessProfile({
    email: 'admin@kronia.com',
    app_metadata: {}
  }, {
    profileIsAdmin: true,
    profileLookupPerformed: true
  });
  assert.equal(yesAdmin.isAdmin, true);
  assert.equal(yesAdmin.source, 'profiles_table');
});

test('env whitelist does not bypass canonical admin in production', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAdmin = process.env.ADMIN_EMAILS;
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_EMAILS = 'admin@kronia.com';

  const profile = access.buildAccessProfile({ email: 'admin@kronia.com' });
  assert.equal(profile.isAdmin, false);
  assert.equal(profile.source, 'awaiting_profiles_resolution');

  process.env.NODE_ENV = prevNodeEnv;
  process.env.ADMIN_EMAILS = prevAdmin;
});
