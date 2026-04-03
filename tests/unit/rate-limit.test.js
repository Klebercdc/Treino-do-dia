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


test('rate limit is isolated by category', async () => {
  const req = reqWithIp('127.0.0.2');
  const optsA = { max: 1, windowMs: 60000, category: 'chat_light' };
  const optsB = { max: 1, windowMs: 60000, category: 'memory_api' };

  const firstA = await checkRateLimit(req, optsA, 'user-rate-limit-isolated');
  const secondA = await checkRateLimit(req, optsA, 'user-rate-limit-isolated');
  const firstB = await checkRateLimit(req, optsB, 'user-rate-limit-isolated');

  assert.equal(firstA.allowed, true);
  assert.equal(secondA.allowed, false);
  assert.equal(firstB.allowed, true);
});
