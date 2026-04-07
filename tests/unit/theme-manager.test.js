const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createClassList() {
  const set = new Set();
  return {
    toggle(name, force) {
      if (typeof force === 'boolean') {
        if (force) set.add(name);
        else set.delete(name);
        return force;
      }
      if (set.has(name)) {
        set.delete(name);
        return false;
      }
      set.add(name);
      return true;
    },
    contains(name) {
      return set.has(name);
    }
  };
}

class MockElement {
  constructor(id = null) {
    this.id = id;
    this.dataset = {};
    this.style = {};
    this.classList = createClassList();
    this.listeners = {};
    this.textContent = '';
    this.attributes = {};
  }
  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }
  dispatch(type) {
    const handlers = this.listeners[type] || [];
    handlers.forEach((fn) => fn({ preventDefault() {} }));
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
}

class MockInput extends MockElement {
  constructor() {
    super();
    this.type = 'checkbox';
    this.checked = false;
  }
}

function createEnv({ storedTheme = null, legacyTheme = null, throwsStorage = false, systemLight = false, readyState = 'complete' } = {}) {
  const localData = {};
  if (storedTheme !== null) localData.kronia_theme = storedTheme;
  if (legacyTheme !== null) localData.kronia_light = legacyTheme;

  const root = new MockElement('html');
  const body = new MockElement('body');
  const settingsThemeVal = new MockElement('settingsThemeVal');
  settingsThemeVal.textContent = 'Escuro';
  const stateBadge = new MockElement('stateBadge');
  const toggleButton = new MockElement('toggleBtn');
  toggleButton.dataset.action = 'toggle-theme';
  const checkbox = new MockInput();
  checkbox.dataset.themeToggleInput = '1';

  const meta = new MockElement('meta');
  meta.setAttribute('name', 'theme-color');
  const head = { appendChild(node) { this.lastChild = node; return node; } };

  const mql = {
    matches: !!systemLight,
    listeners: [],
    addEventListener(type, handler) { if (type === 'change') this.listeners.push(handler); },
    trigger(matches) { this.listeners.forEach((fn) => fn({ matches })); }
  };

  const document = {
    readyState,
    documentElement: root,
    body,
    head,
    getElementById(id) {
      if (id === 'settingsThemeVal') return settingsThemeVal;
      return null;
    },
    querySelector(selector) {
      if (selector === 'meta[name="theme-color"]') return meta;
      if (selector === '[data-theme-toggle-input]') return checkbox;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-theme-state]') return [stateBadge];
      if (selector === '[data-action="toggle-theme"], [data-theme-toggle], [onclick*="toggleTheme"]') return [toggleButton];
      return [];
    },
    createElement() {
      return new MockElement();
    },
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') handler();
    }
  };

  const localStorage = {
    getItem(key) {
      if (throwsStorage) throw new Error('denied');
      return Object.prototype.hasOwnProperty.call(localData, key) ? localData[key] : null;
    },
    setItem(key, value) {
      if (throwsStorage) throw new Error('denied');
      localData[key] = String(value);
    }
  };

  const events = [];
  const window = {
    localStorage,
    matchMedia() { return mql; },
    dispatchEvent(evt) { events.push(evt); },
    addEventListener() {}
  };

  function CustomEvent(type, detail) {
    this.type = type;
    this.detail = detail.detail;
  }

  return { window, document, CustomEvent, HTMLInputElement: MockInput, localData, root, body, meta, mql, settingsThemeVal, stateBadge, toggleButton, checkbox, events };
}

function runThemeScript(env) {
  const appSource = fs.readFileSync('app.js', 'utf8');
  const start = appSource.indexOf("(() => {\n  const THEME_KEY = 'kronia_theme';");
  const end = appSource.indexOf('\n})();', start) + 5;
  const snippet = appSource.slice(start, end);
  const context = vm.createContext(env);
  vm.runInContext(snippet, context);
  return context;
}

test('tema salvo light persiste no boot', () => {
  const env = createEnv({ storedTheme: 'light' });
  runThemeScript(env);
  assert.equal(env.root.dataset.theme, 'light');
  assert.equal(env.settingsThemeVal.textContent, 'Claro');
  assert.equal(env.meta.getAttribute('content'), '#f7f7f8');
});

test('tema salvo dark persiste no boot', () => {
  const env = createEnv({ storedTheme: 'dark' });
  runThemeScript(env);
  assert.equal(env.root.dataset.theme, 'dark');
  assert.equal(env.settingsThemeVal.textContent, 'Escuro');
  assert.equal(env.meta.getAttribute('content'), '#0b0b0f');
});

test('toggle sincroniza dataset, classes e UI', () => {
  const env = createEnv({ storedTheme: 'dark' });
  runThemeScript(env);
  env.window.toggleTheme();
  assert.equal(env.root.dataset.theme, 'light');
  assert.equal(env.body.classList.contains('light-mode'), true);
  assert.equal(env.settingsThemeVal.textContent, 'Claro');
  assert.equal(env.stateBadge.textContent, 'Claro');
  assert.equal(env.localData.kronia_theme, 'light');
});

test('meta theme-color atualiza nos dois modos', () => {
  const env = createEnv({ storedTheme: 'dark' });
  runThemeScript(env);
  assert.equal(env.meta.getAttribute('content'), '#0b0b0f');
  env.window.toggleTheme('light');
  assert.equal(env.meta.getAttribute('content'), '#f7f7f8');
});

test('ausência de localStorage não quebra', () => {
  const env = createEnv({ throwsStorage: true, systemLight: true });
  assert.doesNotThrow(() => runThemeScript(env));
  assert.equal(env.root.dataset.theme, 'light');
});

test('preferência do sistema só sem escolha explícita', () => {
  const noStored = createEnv({ systemLight: true });
  runThemeScript(noStored);
  assert.equal(noStored.root.dataset.theme, 'light');

  const storedDark = createEnv({ storedTheme: 'dark', systemLight: true });
  runThemeScript(storedDark);
  storedDark.mql.trigger(true);
  assert.equal(storedDark.root.dataset.theme, 'dark');
});

test('bind de controles não duplica listeners', () => {
  const env = createEnv({ storedTheme: 'dark' });
  runThemeScript(env);
  assert.equal(env.toggleButton.listeners.click.length, 1);
  env.toggleButton.dispatch('click');
  assert.equal(env.root.dataset.theme, 'light');
});

test('settingsThemeVal fica sincronizado com estado real', () => {
  const env = createEnv({ storedTheme: 'light' });
  runThemeScript(env);
  assert.equal(env.settingsThemeVal.textContent, 'Claro');
  env.window.applyTheme('dark', { persist: true, source: 'test' });
  assert.equal(env.settingsThemeVal.textContent, 'Escuro');
});
