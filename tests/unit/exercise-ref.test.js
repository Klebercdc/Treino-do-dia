const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadExerciseRefRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /function sanitizeExerciseDisplayName\(rawName, fallbackName\) \{[\s\S]*?\n\}/, 'sanitizeExerciseDisplayName'),
    extract(code, /function getExerciseCardTitle\(ex, index\) \{[\s\S]*?\n\}/, 'getExerciseCardTitle'),
    extract(code, /function normalizeExerciseLookupKey\(name\) \{[\s\S]*?\n\}/, 'normalizeExerciseLookupKey'),
    extract(code, /function buildExerciseStubFromPayload\(source = \{\}, fallbackName = "Exercício"\) \{[\s\S]*?\n\}/, 'buildExerciseStubFromPayload'),
    extract(code, /function ensureExerciseRef\(source = \{\}, fallbackName = "Exercício", origin = "workout_builder"\) \{[\s\S]*?\n\}/, 'ensureExerciseRef'),
  ].join('\n\n');

  const context = {
    toSafeTitleCase(value) {
      return String(value || '');
    },
  };
  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'exercise-ref-snippets.js' });
  return context;
}

test('ensureExerciseRef preserves lookup key without inventing slug', () => {
  const runtime = loadExerciseRefRuntime();

  const ref = runtime.ensureExerciseRef(
    {
      display_name: 'Supino Reto',
      normalized_lookup_key: 'supino_reto',
    },
    'Supino Reto',
    'test',
  );

  assert.equal(ref.normalized_lookup_key, 'supino_reto');
  assert.equal(ref.slug, null);
});

test('ensureExerciseRef keeps explicit slug when provided', () => {
  const runtime = loadExerciseRefRuntime();

  const ref = runtime.ensureExerciseRef(
    {
      display_name: 'Bench Press',
      normalized_lookup_key: 'supino_reto',
      slug: 'bench-press',
    },
    'Bench Press',
    'test',
  );

  assert.equal(ref.normalized_lookup_key, 'supino_reto');
  assert.equal(ref.slug, 'bench-press');
});
