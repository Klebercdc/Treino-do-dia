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
    extract(code, /async function fetchExerciseDetailsResponse\(endpoint\) \{[\s\S]*?\n\}/, 'fetchExerciseDetailsResponse'),
    extract(code, /async function openExerciseDetailsByName\(exerciseName, options = \{\}\) \{[\s\S]*?\n\}/, 'openExerciseDetailsByName'),
  ].join('\n\n');

  const calls = { urls: [] };
  const context = {
    URLSearchParams,
    location: { protocol: 'https:', host: 'app.kronia.test' },
    toSafeTitleCase(value) {
      return String(value || '');
    },
    logExerciseDetailsEvent() {},
    openExerciseDiscSheet() {},
    _exerciseDiscSetState() {},
    renderExercise() {},
    document: {
      getElementById() {
        return { textContent: '' };
      },
    },
    apiFetch(url) {
      calls.urls.push(String(url));
      return Promise.resolve({
        ok: true,
        headers: { get() { return 'application/json'; } },
        text: async () => JSON.stringify({ success: true, id: 'ex-1', slug: 'bench-press', names: { pt: 'Supino Reto', en: 'Bench Press' } }),
      });
    },
  };

  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'exercise-details-query-snippets.js' });
  return { context, calls };
}

test('openExerciseDetailsByName sends lookupKey when card has no real slug', async () => {
  const { context, calls } = loadRuntime();

  await context.openExerciseDetailsByName('Supino Reto', {
    origin: 'card',
    exerciseRef: {
      display_name: 'Supino Reto',
      normalized_lookup_key: 'supino_reto',
      slug: null,
    },
  });

  assert.equal(calls.urls.length, 1);
  assert.match(calls.urls[0], /lookupKey=supino_reto/);
  assert.doesNotMatch(calls.urls[0], /slug=supino_reto/);
});

test('openExerciseDetailsByName keeps explicit slug and lookupKey together', async () => {
  const { context, calls } = loadRuntime();

  await context.openExerciseDetailsByName('Bench Press', {
    origin: 'card',
    exerciseRef: {
      display_name: 'Bench Press',
      normalized_lookup_key: 'supino_reto',
      slug: 'bench-press',
    },
  });

  assert.equal(calls.urls.length, 1);
  assert.match(calls.urls[0], /slug=bench-press/);
  assert.match(calls.urls[0], /lookupKey=supino_reto/);
});
