#!/usr/bin/env node
const assert = require('assert');
const access = require('../api/_access');

function resetEnv() {
  delete process.env.ADMIN_EMAILS;
  delete process.env.DEV_EMAILS;
  delete process.env.LOCAL_ADMIN_EMAILS;
  delete process.env.NODE_ENV;
}

function run() {
  resetEnv();
  process.env.ADMIN_EMAILS = 'MeuEmail@Gmail.com, outro@dominio.com ';
  assert.deepStrictEqual(
    access.getPrivilegedEmails().sort(),
    ['meuemail@gmail.com', 'outro@dominio.com'].sort()
  );

  assert.strictEqual(access.normalizeEmail('  FOO@Bar.Com '), 'foo@bar.com');
  assert.strictEqual(access.isPrivilegedEmail('  MEUEMAIL@gmail.com '), true);
  assert.strictEqual(access.isPrivilegedEmail('nao@liberado.com'), false);

  const privilegedProfile = access.buildAccessProfile({ email: ' MeuEmail@gmail.com ' });
  assert.strictEqual(privilegedProfile.isAdmin, true);
  assert.strictEqual(privilegedProfile.canBypassQuota, true);
  assert.strictEqual(privilegedProfile.canSeeDevTools, true);

  const commonProfile = access.buildAccessProfile({ email: 'user@normal.com' });
  assert.strictEqual(commonProfile.isAdmin, false);
  assert.strictEqual(commonProfile.canBypassQuota, false);

  const anonProfile = access.buildAccessProfile(null);
  assert.strictEqual(anonProfile.isAuthenticated, false);
  assert.strictEqual(anonProfile.email, '');

  resetEnv();
  process.env.ADMIN_EMAILS = 'admin@acesso.com';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  const plans = require('../api/_plans');
  plans.getQuotaInfo(
    'user-id',
    function(err, info) {
      assert.ifError(err);
      assert.strictEqual(info.allowed, true);
      assert.strictEqual(info.canBypassQuota, true);
      assert.strictEqual(info.accessMode, 'admin_override');
      console.log('test-access: ok');
    },
    { accessProfile: access.buildAccessProfile('admin@acesso.com') }
  );
}

process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS || 'admin@acesso.com';
run();
