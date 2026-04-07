const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadParserRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const start = code.indexOf('function extractParsableWorkoutJson');
  const end = code.indexOf('function extractWorkoutRenderModel', start);
  if (start < 0 || end < 0) throw new Error('failed to locate workout parser block');
  const snippet = code.slice(start, end);
  const context = {};
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'workout-response-parse.test.js' });
  return context;
}

test('parseWorkoutApiJsonSafely accepts direct JSON', async () => {
  const context = loadParserRuntime();
  const payload = { success: true, plan: { treinos: [] } };
  const response = {
    async text() { return JSON.stringify(payload); },
    headers: { get() { return 'application/json'; } },
  };
  const result = await context.parseWorkoutApiJsonSafely(response);
  assert.equal(JSON.stringify(result), JSON.stringify(payload));
});

test('parseWorkoutApiJsonSafely extracts JSON wrapped in markdown text', async () => {
  const context = loadParserRuntime();
  const payload = { success: true, plan: { treinos: [] }, note: 'ready' };
  const responseText = 'Plano:\n```json\n' + JSON.stringify(payload) + '\n```\nObrigado';
  const response = {
    async text() { return responseText; },
    headers: { get() { return 'text/markdown'; } },
  };
  const result = await context.parseWorkoutApiJsonSafely(response);
  assert.equal(JSON.stringify(result), JSON.stringify(payload));
});

test('parseWorkoutApiJsonSafely returns fallback when no JSON can be parsed', async () => {
  const context = loadParserRuntime();
  const response = {
    async text() { return 'não há dados aqui'; },
    headers: { get() { return 'text/plain'; } },
  };
  const result = await context.parseWorkoutApiJsonSafely(response);
  assert.equal(result.success, false);
  assert.equal(result.error, 'INVALID_JSON');
  assert.equal(result.contentType, 'text/plain');
});
