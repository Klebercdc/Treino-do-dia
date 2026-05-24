// Kronia Motion Accessibility v2.0 — Tests
// Framework: Node.js built-in test runner (node --test)

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS_PATH = path.join(__dirname, '../../styles/animations.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

describe('Motion Accessibility', () => {
  test('prefers-reduced-motion block exists and zeros animation-duration', () => {
    assert.ok(
      css.includes('@media (prefers-reduced-motion: reduce)'),
      'prefers-reduced-motion media query not found'
    );
    assert.ok(
      css.includes('animation-duration:        0.01ms !important'),
      'animation-duration must be zeroed to 0.01ms in reduced-motion'
    );
    assert.ok(
      css.includes('transition-duration:       0.01ms !important'),
      'transition-duration must be zeroed to 0.01ms in reduced-motion'
    );
    assert.ok(
      css.includes('animation-iteration-count: 1      !important'),
      'animation-iteration-count must be 1 in reduced-motion'
    );
  });

  test('k-motion-reduced disables k-motion-background', () => {
    assert.ok(
      css.includes('.k-motion-reduced .k-motion-background'),
      'k-motion-reduced selector for k-motion-background not found'
    );
    assert.ok(
      css.includes('animation: none !important'),
      'k-motion-reduced must disable animation with !important'
    );
  });

  test('k-app-paused pauses k-motion-background', () => {
    assert.ok(
      css.includes('.k-app-paused .k-motion-background'),
      'k-app-paused selector not found'
    );
    assert.ok(
      css.includes('animation-play-state: paused'),
      'k-app-paused must set animation-play-state: paused'
    );
  });

  test('k-stagger delays are zeroed in k-motion-reduced', () => {
    assert.ok(
      css.includes('.k-motion-reduced .k-stagger > *'),
      'k-motion-reduced stagger override not found'
    );
    assert.ok(
      css.includes('animation-delay: 0ms !important'),
      'k-motion-reduced must zero stagger delays'
    );
  });
});

describe('Motion Accessibility — App JS Governor', () => {
  const APP_PATH = path.join(__dirname, '../../app.js');
  const js = fs.readFileSync(APP_PATH, 'utf8');

  test('KRONIA_MOTION_LEVEL global defined on window', () => {
    assert.ok(
      js.includes('window.__KRONIA_MOTION_LEVEL__'),
      '__KRONIA_MOTION_LEVEL__ not set on window'
    );
  });

  test('k-motion-reduced class added when low-end or reduced-motion', () => {
    assert.ok(
      js.includes("classList.add('k-motion-reduced')"),
      'k-motion-reduced class not added in governor'
    );
  });

  test('visibilitychange event adds k-app-paused', () => {
    assert.ok(
      js.includes('visibilitychange'),
      'visibilitychange listener not found'
    );
    assert.ok(
      js.includes("classList.add('k-app-paused')"),
      'k-app-paused not added on visibility hidden'
    );
    assert.ok(
      js.includes("classList.remove('k-app-paused')"),
      'k-app-paused not removed on visibility visible'
    );
  });
});
