const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /function sanitizeExerciseDisplayName\(rawName, fallbackName\) \{[\s\S]*?\n\}/, 'sanitizeExerciseDisplayName'),
    extract(code, /function getExerciseCardTitle\(ex, index\) \{[\s\S]*?\n\}/, 'getExerciseCardTitle'),
    extract(code, /function normalizeExerciseLookupKey\(name\) \{[\s\S]*?\n\}/, 'normalizeExerciseLookupKey'),
    extract(code, /function buildExerciseStubFromPayload\(source = \{\}, fallbackName = "Exercício"\) \{[\s\S]*?\n\}/, 'buildExerciseStubFromPayload'),
    extract(code, /function ensureExerciseRef\(source = \{\}, fallbackName = "Exercício", origin = "workout_builder"\) \{[\s\S]*?\n\}/, 'ensureExerciseRef'),
    extract(code, /function resolveAppApiUrl\(path\) \{[\s\S]*?\n\}/, 'resolveAppApiUrl'),
    extract(code, /function normalizeExerciseDetails\(result\) \{[\s\S]*?\n\}/, 'normalizeExerciseDetails'),
    extract(code, /function normalizeExerciseDetailsPayload\(payload\) \{[\s\S]*?\n\}/, 'normalizeExerciseDetailsPayload'),
    extract(code, /async function fetchExerciseDetailsResponse\(endpoint\) \{[\s\S]*?\n\}/, 'fetchExerciseDetailsResponse'),
    extract(code, /async function openExerciseDetailsByName\(exerciseName, options = \{\}\) \{[\s\S]*?\n\}/, 'openExerciseDetailsByName'),
  ].join('\n\n');

  const state = { errorMessage: '', mode: '' };
  const context = {
    URLSearchParams,
    location: { protocol: 'https:', host: 'app.kronia.test' },
    toSafeTitleCase(value) {
      return String(value || '');
    },
    logExerciseDetailsEvent() {},
    openExerciseDiscSheet() {},
    _exerciseDiscSetState(mode) { state.mode = mode; },
    renderExercise() {},
    document: {
      getElementById(id) {
        if (id === 'exerciseDiscErrorMsg') {
          return {
            set textContent(value) { state.errorMessage = value; },
            get textContent() { return state.errorMessage; },
          };
        }
        return { textContent: '' };
      },
    },
    apiFetch() {
      return Promise.resolve({
        ok: false,
        headers: { get(name) { return name === 'content-type' ? 'text/html' : null; } },
        text: async () => '<!doctype html><title>The page could not be found</title>',
      });
    },
  };

  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'exercise-details-invalid-json.js' });
  return { context, state };
}

test('openExerciseDetailsByName handles HTML response without crashing json parse', async () => {
  const { context, state } = loadRuntime();

  await context.openExerciseDetailsByName('Supino Reto', {
    origin: 'card',
    exerciseRef: {
      display_name: 'Supino Reto',
      normalized_lookup_key: 'supino_reto',
      slug: null,
    },
  });

  assert.equal(state.mode, 'error');
  assert.match(state.errorMessage, /retornou uma página em vez de JSON/i);
});

test('openExerciseDetailsByName retries after iOS PWA pattern error', async () => {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /function sanitizeExerciseDisplayName\(rawName, fallbackName\) \{[\s\S]*?\n\}/, 'sanitizeExerciseDisplayName'),
    extract(code, /function getExerciseCardTitle\(ex, index\) \{[\s\S]*?\n\}/, 'getExerciseCardTitle'),
    extract(code, /function normalizeExerciseLookupKey\(name\) \{[\s\S]*?\n\}/, 'normalizeExerciseLookupKey'),
    extract(code, /function buildExerciseStubFromPayload\(source = \{\}, fallbackName = "Exercício"\) \{[\s\S]*?\n\}/, 'buildExerciseStubFromPayload'),
    extract(code, /function ensureExerciseRef\(source = \{\}, fallbackName = "Exercício", origin = "workout_builder"\) \{[\s\S]*?\n\}/, 'ensureExerciseRef'),
    extract(code, /function resolveAppApiUrl\(path\) \{[\s\S]*?\n\}/, 'resolveAppApiUrl'),
    extract(code, /function normalizeExerciseDetails\(result\) \{[\s\S]*?\n\}/, 'normalizeExerciseDetails'),
    extract(code, /function normalizeExerciseDetailsPayload\(payload\) \{[\s\S]*?\n\}/, 'normalizeExerciseDetailsPayload'),
    extract(code, /async function fetchExerciseDetailsResponse\(endpoint\) \{[\s\S]*?\n\}/, 'fetchExerciseDetailsResponse'),
    extract(code, /async function openExerciseDetailsByName\(exerciseName, options = \{\}\) \{[\s\S]*?\n\}/, 'openExerciseDetailsByName'),
  ].join('\n\n');

  const calls = { apiFetch: 0, fetch: [] };
  const state = { mode: '', errorMessage: '', rendered: null };
  const context = {
    URLSearchParams,
    URL,
    location: { protocol: 'https:', host: 'app.kronia.test', href: 'https://app.kronia.test/app/' },
    toSafeTitleCase(value) {
      return String(value || '');
    },
    logExerciseDetailsEvent() {},
    openExerciseDiscSheet() {},
    _exerciseDiscSetState(mode) { state.mode = mode; },
    renderExercise(payload) { state.rendered = payload; },
    document: {
      getElementById(id) {
        if (id === 'exerciseDiscErrorMsg') {
          return {
            set textContent(value) { state.errorMessage = value; },
            get textContent() { return state.errorMessage; },
          };
        }
        return { textContent: '' };
      },
    },
    async getAuthHeaders() {
      return { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };
    },
    apiFetch() {
      calls.apiFetch += 1;
      return Promise.reject(new Error('The string did not match the expected pattern.'));
    },
    fetch(url, options) {
      calls.fetch.push({ url: String(url), options });
      return Promise.resolve({
        ok: true,
        headers: { get() { return 'application/json'; } },
        text: async () => JSON.stringify({ id: 'ex-1', names: { pt: 'Supino Reto' } }),
      });
    },
  };

  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'exercise-details-pattern-retry.js' });

  await context.openExerciseDetailsByName('Supino Reto', {
    origin: 'card',
    exerciseRef: {
      display_name: 'Supino Reto',
      normalized_lookup_key: 'supino_reto',
      slug: null,
    },
  });

  assert.equal(calls.apiFetch, 1);
  assert.equal(calls.fetch.length, 1);
  assert.equal(state.errorMessage, '');
  assert.equal(state.rendered?.id, 'ex-1');
  assert.equal(state.rendered?.names?.pt, 'Supino Reto');
});
