const test = require('node:test');
const assert = require('node:assert/strict');

const access = require('../../src/server/apihelpers/_access');

test('buildAccessProfile marks admin from JWT app_metadata claim when profile was not loaded', () => {
  const profile = access.buildAccessProfile({
    email: 'ops@kronia.com',
    app_metadata: { role: 'admin' }
  });
  assert.equal(profile.isAdmin, true);
  assert.equal(profile.source, 'jwt_claim');
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
