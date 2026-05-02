const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('customModal closed state cannot block clicks', () => {
  const css = read('styles.css');
  const app = read('app.js');

  assert.match(css, /#customModal\s*\{[\s\S]*?display:\s*none[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /#customModal\.show\s*\{[\s\S]*?display:\s*flex;[\s\S]*?pointer-events:\s*auto;/);
  assert.match(css, /#customModal:not\(\.show\)\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;[\s\S]*?visibility:\s*hidden\s*!important;/);
  assert.doesNotMatch(css, /#customModal\.show\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  assert.match(app, /function closeCustomModalElement\(modal\)\s*\{[\s\S]*?classList\.remove\("show"\)[\s\S]*?aria-hidden",\s*"true"[\s\S]*?pointerEvents\s*=\s*"none"/);
});

test('legacy diet guard hides only legacy screens and preserves official diet views', () => {
  const source = read('src/ui/diet/disable-legacy-diet.js');
  const legacyIds = ['nutritionFlowScreen', 'dietChoiceScreen', 'dietDataScreen', 'dietEmergencyWizardScreen'];
  const protectedIds = ['dietProfileWizardScreen', 'kroniaDietPlanVisualScreen'];

  for (const id of legacyIds) assert.match(source, new RegExp(`'${id}'`));
  for (const id of protectedIds) assert.match(source, new RegExp(`'${id}'`));
  assert.doesNotMatch(source, /setInterval/);

  function makeElement(id) {
    const classes = new Set(['show']);
    return {
      id,
      attributes: {},
      style: {
        values: {},
        setProperty(name, value) { this.values[name] = value; },
      },
      classList: {
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); },
      },
      closest(selector) {
        return selector === '#' + id ? this : null;
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
    };
  }

  const elements = Object.fromEntries([...legacyIds, ...protectedIds].map(id => [id, makeElement(id)]));
  const protectedChildren = protectedIds.map(id => makeElement(id + '-child'));
  const context = {
    window: {},
    document: {
      readyState: 'complete',
      getElementById(id) { return elements[id] || null; },
      addEventListener() {},
      querySelectorAll() { return protectedChildren; },
    },
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.globalThis = context.window;

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'disable-legacy-diet.js' });

  for (const id of legacyIds) {
    assert.equal(elements[id].style.values.display, 'none');
    assert.equal(elements[id].style.values['pointer-events'], 'none');
    assert.equal(elements[id].attributes['aria-hidden'], 'true');
  }
  for (const id of protectedIds) {
    assert.equal(elements[id].style.values.display, undefined);
    assert.equal(elements[id].attributes['aria-hidden'], undefined);
  }
  for (const child of protectedChildren) {
    assert.equal(child.style.pointerEvents, 'auto');
    assert.equal(child.attributes['aria-disabled'], undefined);
  }
});

test('KroniaDiet.open performs overlay cleanup and legacy guard before opening wizard', () => {
  const source = read('src/ui/diet/diet-entry-controller.js');

  assert.match(source, /window\.KroniaUI\.unblockScreens\('before-diet-open'\)/);
  assert.match(source, /window\.KroniaDiet\.hideLegacyScreens\(\)/);
  assert.match(source, /window\.openNutritionFlow\s*=\s*function\(\)\{[\s\S]*?window\.KroniaDiet\.open/);
  assert.match(source, /window\.openNutritionFlowFull\s*=\s*function\(\)\{[\s\S]*?window\.KroniaDiet\.open/);
  assert.doesNotMatch(source, /setInterval\(legacyWatchdog/);
});

test('service worker is clean UI cache only and does not mutate HTML or inject diet scripts', () => {
  const source = read('sw.js');

  assert.match(source, /const CACHE = 'kronia-fix-nav-20260502'/);
  assert.match(source, /const BUILD_VERSION = '20260502-fix-nav'/);
  assert.doesNotMatch(source, /injectDietController/);
  assert.doesNotMatch(source, /LEGACY_PROFILE_BASE_KILLER/);
  assert.doesNotMatch(source, /DIET_SCRIPTS/);
  assert.doesNotMatch(source, /\.replace\(/);
  assert.doesNotMatch(source, /setInterval/);
  assert.ok(source.includes("pathname.startsWith('/api/')"));
  assert.match(source, /event\.request\.mode === 'navigate'[\s\S]*networkFirst/);
});
