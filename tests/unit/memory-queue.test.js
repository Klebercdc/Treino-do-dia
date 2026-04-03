const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test_service_key';

const plans = require('../../src/server/apihelpers/_plans');
const userMemory = require('../../src/server/apihelpers/_userMemory');

function withSupabaseMock(handler, fn) {
  const original = plans.supabaseRequest;
  plans.supabaseRequest = handler;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      plans.supabaseRequest = original;
    });
}

test('enqueue sem processamento inline', async () => {
  const calls = [];
  await withSupabaseMock((method, path, body, cb) => {
    calls.push({ method, path, body });
    if (path === 'user_memory_events' && method === 'POST') return cb(null, [{ id: 'evt_1' }]);
    if (path === 'rpc/enqueue_memory_recompute_job' && method === 'POST') return cb(null, 'job_1');
    if (path.includes('user_memory_state')) return cb('unexpected inline recompute', null);
    return cb(null, []);
  }, async () => {
    const result = await userMemory.captureEventAndEnqueue({
      userId: 'user-1',
      eventType: 'checkin',
      payload: { sleep_hours: 7, fatigue_level: 4 },
      requestId: 'req-enqueue-1',
      component: 'unit-test',
      source: 'memory_api',
    });

    assert.equal(result.queued, true);
    assert.equal(result.job.jobId, 'job_1');
    assert.equal(calls.some((c) => c.path === 'rpc/claim_memory_recompute_jobs'), false);
  });
});

test('claim/process/complete de job', async () => {
  const calls = [];
  await withSupabaseMock((method, path, body, cb) => {
    calls.push({ method, path, body });
    if (path === 'rpc/claim_memory_recompute_jobs') {
      return cb(null, [{ id: 'job-claim-1', user_id: 'user-1', status: 'processing', blocks: ['coaching_summary'], attempts: 1, max_attempts: 5, latest_request_id: 'req-claim-1', latest_component: 'unit-test' }]);
    }
    if (path.startsWith('user_memory_state?') && method === 'GET') return cb(null, []);
    if (path.startsWith('workouts?')) return cb(null, []);
    if (path.startsWith('profiles?')) return cb(null, []);
    if (path.startsWith('nutrition_goals?')) return cb(null, []);
    if (path.startsWith('user_memory_events?')) return cb(null, []);
    if (path === 'user_memory_state' && method === 'POST') return cb(null, [{ user_id: 'user-1' }]);
    if (path === 'user_memory_audit_logs' && method === 'POST') return cb(null, [{ id: 'log-1' }]);
    if (path === 'rpc/complete_memory_recompute_job' && method === 'POST') return cb(null, true);
    return cb(null, []);
  }, async () => {
    const claimed = await userMemory.claimQueuedMemoryJobs({ limit: 5, lockToken: 'lock-1' });
    assert.equal(claimed.jobs.length, 1);

    const processed = await userMemory.processMemoryRecomputeJob({ job: claimed.jobs[0], lockToken: claimed.lockToken });
    assert.equal(processed.status, 'completed');
    assert.equal(calls.some((c) => c.path === 'rpc/complete_memory_recompute_job'), true);
  });
});

test('retry/fail do worker', async () => {
  await withSupabaseMock((method, path, body, cb) => {
    if (path.startsWith('user_memory_state?') && method === 'GET') return cb(null, []);
    if (path === 'user_memory_state' && method === 'POST') return cb('upsert failed', null);
    if (path.startsWith('user_memory_state?user_id=eq.') && method === 'PATCH') return cb('patch failed', null);
    if (path === 'rpc/fail_memory_recompute_job') return cb(null, [{ job_id: body.p_job_id, status: 'retryable', attempts: 1, max_attempts: 5 }]);
    if (path === 'user_memory_audit_logs' && method === 'POST') return cb(null, [{ id: 'log-2' }]);
    return cb(null, []);
  }, async () => {
    const retryable = await userMemory.processMemoryRecomputeJob({
      job: { id: 'job-r1', user_id: 'user-1', status: 'processing', blocks: ['coaching_summary'], attempts: 1, max_attempts: 5, latest_request_id: 'req-r1', latest_component: 'worker' },
      lockToken: 'lock-r1',
    });
    assert.equal(retryable.status, 'retryable');
  });

  await withSupabaseMock((method, path, body, cb) => {
    if (path.startsWith('user_memory_state?') && method === 'GET') return cb(null, []);
    if (path === 'user_memory_state' && method === 'POST') return cb('upsert failed', null);
    if (path.startsWith('user_memory_state?user_id=eq.') && method === 'PATCH') return cb('patch failed', null);
    if (path === 'rpc/fail_memory_recompute_job') return cb(null, [{ job_id: body.p_job_id, status: 'failed', attempts: 5, max_attempts: 5 }]);
    if (path === 'user_memory_audit_logs' && method === 'POST') return cb(null, [{ id: 'log-3' }]);
    return cb(null, []);
  }, async () => {
    const failed = await userMemory.processMemoryRecomputeJob({
      job: { id: 'job-f1', user_id: 'user-1', status: 'processing', blocks: ['coaching_summary'], attempts: 5, max_attempts: 5, latest_request_id: 'req-f1', latest_component: 'worker' },
      lockToken: 'lock-f1',
    });
    assert.equal(failed.status, 'failed');
  });
});

test('idempotência básica do job via enqueue rpc', async () => {
  let enqueueCount = 0;
  await withSupabaseMock((method, path, body, cb) => {
    if (path === 'rpc/enqueue_memory_recompute_job') {
      enqueueCount += 1;
      return cb(null, 'job-stable-1');
    }
    return cb(null, []);
  }, async () => {
    const a = await userMemory.enqueueMemoryRecomputeJob({ userId: 'user-1', blocks: ['coaching_summary'], requestId: 'req-1', component: 'memory_api' });
    const b = await userMemory.enqueueMemoryRecomputeJob({ userId: 'user-1', blocks: ['coaching_summary'], requestId: 'req-2', component: 'memory_api' });
    assert.equal(a.jobId, 'job-stable-1');
    assert.equal(b.jobId, 'job-stable-1');
    assert.equal(enqueueCount, 2);
  });
});
