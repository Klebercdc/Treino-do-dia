const test = require('node:test');
const assert = require('node:assert/strict');

const memoryValidation = require('../../src/server/apihelpers/_memoryValidation');

test('rejects unknown memory event type', () => {
  const result = memoryValidation.validateMemoryEventInput({
    eventType: 'hack_attempt',
    payload: { x: 1 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'MEMORY_EVENT_TYPE_INVALID');
});

test('normalizes and accepts valid checkin payload', () => {
  const result = memoryValidation.validateMemoryEventInput({
    eventType: 'checkin',
    payload: {
      sleep_hours: '7.5',
      soreness_level: 3,
      fatigue_level: 2,
      mood: 'boa',
      ignored_field: 'x',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.eventType, 'checkin');
  assert.deepEqual(result.payload, {
    sleep_hours: 7.5,
    soreness_level: 3,
    fatigue_level: 2,
    mood: 'boa',
  });
});

test('rejects payload without valid semantic fields', () => {
  const result = memoryValidation.validateMemoryEventInput({
    eventType: 'weight_update',
    payload: { weight_kg: -10 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'MEMORY_EVENT_PAYLOAD_INVALID');
});


test('rejects invalid memory source', () => {
  const result = memoryValidation.validateMemoryEventInput({
    eventType: 'checkin',
    source: 'webhook_external',
    payload: { sleep_hours: 7 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'MEMORY_SOURCE_INVALID');
});
