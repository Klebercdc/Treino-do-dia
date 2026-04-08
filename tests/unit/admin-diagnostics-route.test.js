const test = require('node:test');
const assert = require('node:assert/strict');

const HANDLER_PATH = require.resolve('../../src/server/legacy/admin-diagnostics.js');
const CORS_PATH = require.resolve('../../src/server/apihelpers/_cors.js');
const AUTH_PATH = require.resolve('../../src/server/apihelpers/_auth.js');
const ADMIN_GUARD_PATH = require.resolve('../../src/server/apihelpers/_adminGuard.js');
const PLANS_PATH = require.resolve('../../src/server/apihelpers/_plans.js');
const DIAGNOSTIC_TRACKER_PATH = require.resolve('../../src/server/apihelpers/_diagnosticTracker.js');

function createResponseHarness() {
  let settled = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });

  const response = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      if (!settled) {
        settled = true;
        resolveDone();
      }
      return this;
    },
    end() {
      if (!settled) {
        settled = true;
        resolveDone();
      }
      return this;
    }
  };

  return { response, done };
}

function withStubbedModule(modulePath, exportsValue) {
  const original = require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue
  };
  return function restore() {
    if (original) require.cache[modulePath] = original;
    else delete require.cache[modulePath];
  };
}

function loadHandlerWithStubs(options) {
  const restores = [];
  delete require.cache[HANDLER_PATH];
  delete require.cache[DIAGNOSTIC_TRACKER_PATH];

  restores.push(withStubbedModule(CORS_PATH, {
    setCors: function() {}
  }));

  restores.push(withStubbedModule(AUTH_PATH, {
    requireAuth: function(req, res, next) {
      next({ id: 'user-1', email: 'admin@kronia.com' });
    }
  }));

  restores.push(withStubbedModule(ADMIN_GUARD_PATH, {
    requireAdminAsync: function(user, res, callback) {
      callback({ isAdmin: true, source: 'unit-test' });
    }
  }));

  restores.push(withStubbedModule(PLANS_PATH, {
    supabaseRequest: options.supabaseRequest
  }));

  const handler = require(HANDLER_PATH);
  return {
    handler,
    restore: function() {
      delete require.cache[HANDLER_PATH];
      delete require.cache[DIAGNOSTIC_TRACKER_PATH];
      while (restores.length) {
        const restore = restores.pop();
        restore();
      }
    }
  };
}

async function invokeHandler(handler, req) {
  const harness = createResponseHarness();
  handler(req, harness.response);
  await harness.done;
  return harness.response;
}

test('admin diagnostics rejeita ação GET inválida com contrato estável', async () => {
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, _path, _body, callback) {
      callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'GET',
      query: { action: 'nao_existe' },
      headers: {}
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_ACTION');
    assert.ok(Array.isArray(res.body.error.details.validActions));
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics recent degrada com segurança quando coluna opcional não existe', async () => {
  const calls = [];
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(method, path, _body, callback) {
      calls.push({ method, path });
      if (path.includes('diagnostic_executions?select=') && path.includes('conversation_trace_id')) {
        return callback('column "conversation_trace_id" of relation "diagnostic_executions" does not exist');
      }

      if (path.includes('diagnostic_executions?select=')) {
        return callback(null, [{
          execution_id: 'exec-1',
          parent_execution_id: null,
          user_id: 'user-1',
          source: 'chat',
          input_type: 'text',
          raw_input_summary: 'oi',
          normalized_input_summary: 'oi',
          intent_detected: 'greeting',
          intent_confidence: 0.99,
          pipeline_selected: 'local_reply',
          fallback_used: false,
          duration_ms: 12,
          final_status: 'success',
          success: true,
          severity: 'info',
          created_at: '2026-04-08T00:00:00.000Z',
          decision_reason: 'saudacao',
          response_summary: 'ok',
          graph_path: []
        }]);
      }

      return callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'GET',
      query: { action: 'recent' },
      headers: {}
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.executions.length, 1);
    assert.equal(res.body.data.executions[0].conversation_trace_id, null);
    assert.equal(res.body.data.executions[0].correlation_id, null);
    assert.ok(calls.length >= 2);
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics exercise_catalog resume corretamente video gif e text-only', async () => {
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, path, _body, callback) {
      if (path.startsWith('exercises?select=')) {
        return callback(null, [
          {
            id: '1',
            normalized_lookup_key: 'push_up',
            target_muscle: 'chest',
            media_type: 'video',
            media_url: 'https://cdn.example/video.mp4',
            gif_url: null,
            instructions: ['a', 'b'],
            common_errors: ['x'],
            breathing_tip: 'expire',
            completeness_score: 88,
            media_confidence_score: 0.92,
            quality_flags: [],
            is_active: true
          },
          {
            id: '2',
            normalized_lookup_key: 'row',
            target_muscle: 'back',
            media_type: 'gif',
            media_url: null,
            gif_url: 'https://cdn.example/row.gif',
            instructions: ['a'],
            common_errors: [],
            breathing_tip: null,
            completeness_score: 80,
            media_confidence_score: 0.8,
            quality_flags: [],
            is_active: true
          },
          {
            id: '3',
            normalized_lookup_key: 'plank',
            target_muscle: 'core',
            media_type: null,
            media_url: null,
            gif_url: null,
            instructions: [],
            common_errors: [],
            breathing_tip: null,
            completeness_score: 42,
            media_confidence_score: 0.2,
            quality_flags: ['low_content_value'],
            is_active: true
          }
        ]);
      }

      return callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'GET',
      query: { action: 'exercise_catalog' },
      headers: {}
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.summary.total, 3);
    assert.equal(res.body.data.summary.with_video, 1);
    assert.equal(res.body.data.summary.with_gif, 1);
    assert.equal(res.body.data.summary.text_only, 1);
    assert.equal(res.body.data.summary.low_content_value_count, 1);
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics simulate roteia pedido de treino para open_workout_flow', async () => {
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, _path, _body, callback) {
      callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'POST',
      query: { action: 'simulate' },
      headers: {},
      body: {
        text: 'quero montar um treino de hipertrofia',
        scenario: 'workout_flow',
        disable_persistence: true
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.simulated, true);
    assert.equal(res.body.data.persisted, false);
    assert.equal(res.body.data.decision.action, 'open_workout_flow');
    assert.equal(res.body.data.decision.intent, 'request');
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics simulate roteia pedido de dieta para open_diet_flow', async () => {
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, _path, _body, callback) {
      callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'POST',
      query: { action: 'simulate' },
      headers: {},
      body: {
        text: 'quero montar uma dieta para secar',
        scenario: 'diet_flow',
        disable_persistence: true
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.decision.action, 'open_diet_flow');
    assert.equal(res.body.data.decision.intent, 'request');
    assert.equal(res.body.data.report.summary.status, 'simulated_success');
    assert.equal(res.body.data.report.summary.success, true);
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics simulate expõe fallback coerente quando falha de LLM é forçada', async () => {
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, _path, _body, callback) {
      callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'POST',
      query: { action: 'simulate' },
      headers: {},
      body: {
        text: 'quero entender creatina',
        scenario: 'forced_llm_failure',
        disable_persistence: true,
        force_llm_failure: true
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.simulated, true);
    assert.equal(res.body.data.persisted, false);
    assert.equal(res.body.data.flags.forceLlmFailure, true);
    assert.equal(res.body.data.report.summary.status, 'simulated_failure');
    assert.equal(res.body.data.report.summary.success, false);
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics health reflete warning quando GROQ_API_KEY está ausente', async () => {
  const previousGroqKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, path, _body, callback) {
      if (path.startsWith('diagnostic_execution_health?select=*')) {
        return callback(null, [
          {
            component: 'call_llm_short',
            total: 20,
            failure_total: 1,
            success_total: 19,
            avg_duration_ms: 820,
            fallback_rate: 0.05
          }
        ]);
      }
      if (path.includes('diagnostic_executions?select=')) {
        return callback(null, []);
      }
      return callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'GET',
      query: { action: 'health' },
      headers: {}
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const aiProvider = res.body.data.checks.find((item) => item.key === 'ai_provider');
    assert.ok(aiProvider);
    assert.equal(aiProvider.status, 'warning');
  } finally {
    if (previousGroqKey) process.env.GROQ_API_KEY = previousGroqKey;
    else delete process.env.GROQ_API_KEY;
    loaded.restore();
  }
});

test('admin diagnostics simulate persiste execução e steps quando persistence está habilitada', async () => {
  const calls = [];
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(method, path, body, callback) {
      calls.push({ method, path, body });

      if (method === 'POST' && path === 'diagnostic_executions') {
        return callback(null, [{ execution_id: 'exec-persisted-1' }]);
      }
      if (method === 'POST' && path === 'diagnostic_steps') {
        return callback(null, [{ ok: true }]);
      }

      return callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'POST',
      query: { action: 'simulate' },
      headers: {},
      body: {
        text: 'quero montar um treino de hipertrofia',
        scenario: 'persisted_workout_flow'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.simulated, true);
    assert.equal(res.body.data.persisted, true);
    assert.equal(res.body.data.decision.action, 'open_workout_flow');
    assert.ok(calls.some((item) => item.method === 'POST' && item.path === 'diagnostic_executions'));
    assert.ok(calls.some((item) => item.method === 'POST' && item.path === 'diagnostic_steps'));
  } finally {
    loaded.restore();
  }
});

test('admin diagnostics overview agrega blocos reais e preserva erros parciais', async () => {
  const loaded = loadHandlerWithStubs({
    supabaseRequest: function(_method, path, _body, callback) {
      if (path.startsWith('diagnostic_execution_health?select=*')) {
        return callback(null, [
          {
            component: 'call_llm_short',
            total: 12,
            failure_total: 2,
            success_total: 10,
            avg_duration_ms: 900,
            fallback_rate: 0.08
          }
        ]);
      }

      if (path.startsWith('diagnostic_steps?select=node_key')) {
        return callback(null, [
          { node_key: 'Recomendacao', success: true, duration_ms: 140, error_code: null, error_message: null, created_at: '2026-04-08T00:00:00.000Z' },
          { node_key: 'Treino', success: false, duration_ms: 210, error_code: 'FAIL', error_message: 'boom', created_at: '2026-04-08T00:01:00.000Z' }
        ]);
      }

      if (path.startsWith('exercises?select=')) {
        return callback('catalog_temporarily_unavailable');
      }

      if (path.includes('diagnostic_executions?select=')) {
        return callback(null, [{
          execution_id: 'exec-ov-1',
          parent_execution_id: null,
          user_id: 'user-1',
          source: 'chat',
          input_type: 'text',
          raw_input_summary: 'oi',
          normalized_input_summary: 'oi',
          intent_detected: 'greeting',
          intent_confidence: 0.99,
          pipeline_selected: 'local_reply',
          fallback_used: false,
          duration_ms: 18,
          final_status: 'success',
          success: true,
          severity: 'info',
          created_at: '2026-04-08T00:00:00.000Z',
          decision_reason: 'saudacao',
          response_summary: 'ok',
          graph_path: []
        }]);
      }

      return callback(null, []);
    }
  });

  try {
    const res = await invokeHandler(loaded.handler, {
      method: 'GET',
      query: { action: 'overview' },
      headers: {}
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.overview));
    assert.ok(Array.isArray(res.body.data.recent));
    assert.ok(Array.isArray(res.body.data.node_stats));
    assert.ok(Array.isArray(res.body.data.alerts));
    assert.ok(Array.isArray(res.body.data.checklist));
    assert.equal(res.body.data.exercise_catalog, null);
    assert.equal(res.body.data.errors.exercise_catalog, 'catalog_temporarily_unavailable');
  } finally {
    loaded.restore();
  }
});
