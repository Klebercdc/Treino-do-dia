const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function createElement(tagName) {
  return {
    tagName,
    className: '',
    textContent: '',
    attributes: {},
    children: [],
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || ''; },
    appendChild(child) { this.children.push(child); return child; },
  };
}

function loadRenderRuntime() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippets = [
    extract(code, /var KRONIA_CTA_ALLOWED_ACTIONS = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ALLOWED_ACTIONS'),
    extract(code, /var KRONIA_CTA_ACTION_ALIASES = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'KRONIA_CTA_ACTION_ALIASES'),
    extract(code, /function normalizeCtaPayload\(payload\) \{[\s\S]*?\n\}/, 'normalizeCtaPayload'),
    extract(code, /function normalizeKroniaAction\(action\) \{[\s\S]*?\n\}/, 'normalizeKroniaAction'),
    extract(code, /function renderConversationCta\(containerId, cta, payload\) \{[\s\S]*?\n\}/, 'renderConversationCta'),
  ].join('\n\n');

  const container = createElement('div');
  container.scrollHeight = 900;
  container.scrollTop = 0;

  const document = {
    getElementById(id) {
      if (id === 'messages') return container;
      return null;
    },
    createElement,
  };

  const context = {
    document,
    JSON,
    Date,
    writeAuditTracePatch() {},
  };
  vm.createContext(context);
  vm.runInContext(snippets, context, { filename: 'cta-render-snippets.js' });

  return { context, container };
}

test('renderConversationCta outputs button with canonical action and attrs', () => {
  const { context, container } = loadRenderRuntime();

  const wrap = context.renderConversationCta(
    'messages',
    { action: 'open_training_builder', label: 'Abrir treino' },
    { source: 'test', _targetModule: 'programa' }
  );

  assert.ok(wrap);
  assert.equal(container.children.length, 1);
  const button = wrap.children[0].children[0].children[0];
  assert.equal(button.tagName, 'button');
  assert.equal(button.getAttribute('data-action'), 'open_training');
  assert.equal(button.getAttribute('data-cta-label'), 'Abrir treino');
  assert.ok(button.getAttribute('data-cta-payload').includes('"source":"test"'));
  assert.ok(!button.getAttribute('data-cta-payload').includes('_targetModule'));
  assert.ok(button.getAttribute('data-cta-meta').includes('conversation_message'));
  assert.equal(container.scrollTop, 900);
});
