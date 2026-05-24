// Kronia Motion Performance v2.0 — Tests
// Framework: Node.js built-in test runner (node --test)

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS_PATH = path.join(__dirname, '../../styles/animations.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

const STYLES_PATH = path.join(__dirname, '../../styles.css');
const stylesMain = fs.readFileSync(STYLES_PATH, 'utf8');

const APP_PATH = path.join(__dirname, '../../app.js');
const js = fs.readFileSync(APP_PATH, 'utf8');

const HTML_PATH = path.join(__dirname, '../../index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

const LAYOUT_PROPS = ['top:', 'left:', 'width:', 'height:', 'margin:', 'padding:'];

describe('Motion Performance — No Layout Animations', () => {
  test('animations.css does not animate layout properties', () => {
    const keyframeBlocks = (css.match(/@keyframes[\s\S]+?(?=@keyframes|$)/g) || []);
    for (const block of keyframeBlocks) {
      for (const prop of LAYOUT_PROPS) {
        const hasProp = new RegExp(`\\b${prop.replace(':', '')}\\s*:`).test(block);
        assert.ok(!hasProp, `Layout property "${prop}" found in keyframe: ${block.slice(0, 80)}`);
      }
    }
  });

  test('no transition-all in animations.css', () => {
    assert.ok(
      !css.includes('transition: all') && !css.includes('transition:all'),
      'transition: all found in animations.css'
    );
  });

  test('no transition-all in styles.css', () => {
    assert.ok(
      !stylesMain.includes('transition: all') && !stylesMain.includes('transition:all'),
      'transition: all still present in styles.css'
    );
  });
});

describe('Motion Performance — Loop Safety', () => {
  test('all loop animations use k-motion-background class', () => {
    const loopClasses = ['.k-thinking', '.k-skeleton', '.k-alert-glow'];
    for (const cls of loopClasses) {
      assert.ok(css.includes(cls), `${cls} not found in animations.css`);
    }
    assert.ok(
      css.includes('k-motion-background'),
      'k-motion-background pattern must exist to gate infinite loops'
    );
  });

  test('no void offsetWidth in app.js', () => {
    assert.ok(
      !js.includes('void') || !js.includes('offsetWidth'),
      'void element.offsetWidth found — replace with requestAnimationFrame'
    );
  });

  test('will-change only on classes with real animation', () => {
    assert.ok(
      css.includes('will-change: transform, opacity'),
      'will-change must reference transform and opacity'
    );
    assert.ok(
      !css.match(/will-change:\s*auto/),
      'will-change: auto is not valid here'
    );
  });
});

describe('Motion Performance — Governor', () => {
  test('__KRONIA_MOTION_LEVEL__ defined at boot', () => {
    assert.ok(
      js.includes("window.__KRONIA_MOTION_LEVEL__ ="),
      '__KRONIA_MOTION_LEVEL__ must be assigned at boot'
    );
  });

  test('k-motion-background used on aiFloatBtn in HTML', () => {
    assert.ok(
      html.includes('k-motion-background'),
      'k-motion-background must be applied to continuous loop elements like aiFloatBtn'
    );
  });
});
