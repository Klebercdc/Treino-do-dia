const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

test('normalizeScientificProfileInput prefers current diet payload over persisted config', () => {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function pickScientificProfileValue\(\) \{[\s\S]*?\n\}/, 'pickScientificProfileValue'),
    extract(code, /function normalizeScientificProfileInput\(input\) \{[\s\S]*?\n\}/, 'normalizeScientificProfileInput'),
  ].join('\n\n');

  const context = {
    safeJSON() {
      return {
        sexo: 'masculino',
        idade: 44,
        peso: 91,
        altura: 181,
        atividade: 'sedentario',
      };
    },
  };

  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-science-context-snippet.js' });

  const result = context.normalizeScientificProfileInput({
    sexo: 'feminino',
    idade: 30,
    peso: 65,
    altura: 168,
    nivelAtividade: 'moderadamente ativo',
  });

  assert.equal(result.sexo, 'feminino');
  assert.equal(result.idade, 30);
  assert.equal(result.peso, 65);
  assert.equal(result.altura, 168);
  assert.equal(result.atividade, 'moderadamente ativo');
});
