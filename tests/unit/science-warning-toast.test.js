const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

test('scientific warning toast only shows for weak evidence', () => {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = extract(
    code,
    /function shouldShowScientificWarningToast\(guard\) \{[\s\S]*?\n\}/,
    'shouldShowScientificWarningToast',
  );

  const context = {};
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'science-warning-snippet.js' });

  assert.equal(context.shouldShowScientificWarningToast({
    warningMessage: 'Evidência científica parcial',
    evidenceState: 'weak_evidence',
  }), true);

  assert.equal(context.shouldShowScientificWarningToast({
    warningMessage: 'Sem evidência específica disponível agora',
    evidenceState: 'no_evidence',
  }), false);

  assert.equal(context.shouldShowScientificWarningToast({
    warningMessage: null,
    evidenceState: 'weak_evidence',
  }), false);
});
