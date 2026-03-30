const test = require('node:test');
const assert = require('node:assert/strict');

const access = require('../../src/server/apihelpers/_access');

test('buildAccessProfile marks admin from JWT app_metadata claim', () => {
  const profile = access.buildAccessProfile({
    email: 'ops@kronia.com',
    app_metadata: { role: 'admin' }
  });
  assert.equal(profile.isAdmin, true);
  assert.equal(profile.source, 'jwt_claim');
});

test('buildAccessProfile prioritizes profiles flag as canonical source', () => {
  const profile = access.buildAccessProfile({
    email: 'member@kronia.com',
    app_metadata: {}
  }, { profileIsAdmin: true });
  assert.equal(profile.isAdmin, true);
  assert.equal(profile.source, 'profiles_table');
  assert.equal(profile.profileIsAdmin, true);
});
