const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const SYSTEM_PATH = require.resolve('../../api/system.js');

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

async function invoke(handler, req) {
  const harness = createResponseHarness();
  const result = handler(req, harness.response);
  if (result && typeof result.then === 'function') {
    await result;
  }
  await harness.done;
  return harness.response;
}

function loadSystemHandler() {
  const originalLoad = Module._load;
  // Provide minimal stubs for modules unavailable in the test environment
  // so system.js can be loaded in isolation.
  Module._load = function(request, parent, isMain) {
    if (request === '@supabase/supabase-js') {
      return { createClient: function() { return { from: function() { return {}; }, auth: {} }; } };
    }
    return originalLoad.apply(this, arguments);
  };
  try {
    delete require.cache[SYSTEM_PATH];
    return require(SYSTEM_PATH);
  } finally {
    Module._load = originalLoad;
  }
}

function withMissingScienceModule(callback) {
  const originalLoad = Module._load;

  Module._load = function(request, parent, isMain) {
    if (request === '../src/lib/science/scienceSyncService') {
      const error = new Error("Cannot find module '@supabase/supabase-js'");
      error.code = 'MODULE_NOT_FOUND';
      throw error;
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    return callback();
  } finally {
    Module._load = originalLoad;
  }
}

test('api/system carrega sem importar science no bootstrap e rota desconhecida responde 404', async () => {
  const handler = loadSystemHandler();

  const res = await invoke(handler, {
    method: 'GET',
    query: { __route: 'nao-existe' },
    headers: {}
  });

  assert.equal(typeof handler, 'function');
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'rota não encontrada' });
});

test('api/system isola falha de science e retorna erro controlado apenas na rota afetada', async () => {
  const handler = loadSystemHandler();

  const res = await withMissingScienceModule(() => invoke(handler, {
    method: 'GET',
    query: { __route: 'science-review' },
    headers: {}
  }));

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'ROUTE_DEPENDENCY_UNAVAILABLE');
  assert.equal(res.body.route, 'science-review');
  assert.match(res.body.warning, /@supabase\/supabase-js/);
});
