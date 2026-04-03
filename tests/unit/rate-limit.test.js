const test = require('node:test');
const assert = require('node:assert/strict');

const { checkRateLimit } = require('../../src/server/apihelpers/_ratelimit');

function reqWithIp(ip) {
  return { headers: { 'x-forwarded-for': ip } };
}

test('local fallback rate limit blocks after threshold', async () => {
  const req = reqWithIp('127.0.0.1');
  const opts = { max: 2, windowMs: 60000, category: 'unit_test' };

  const first = await checkRateLimit(req, opts, 'user-rate-limit-test');
  const second = await checkRateLimit(req, opts, 'user-rate-limit-test');
  const third = await checkRateLimit(req, opts, 'user-rate-limit-test');

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSec >= 1);
});
