const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiEnvelope } = require('../../src/server/apihelpers/_response');

test('response envelope keeps requestId and userId consistently', () => {
  const envelope = createApiEnvelope({
    success: true,
    type: 'memory_queue_worker',
    message: 'ok',
    requestId: 'req-123',
    userId: 'user-123',
    data: { summary: true },
  });

  assert.equal(envelope.ok, true);
  assert.equal(envelope.requestId, 'req-123');
  assert.equal(envelope.userId, 'user-123');
  assert.equal(envelope.meta.requestId, 'req-123');
  assert.equal(envelope.meta.userId, 'user-123');
});
