// Kronia Motion System v2.0 — Tests
// Framework: Node.js built-in test runner (node --test)

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS_PATH = path.join(__dirname, '../../styles/animations.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

describe('Motion System — CSS Classes', () => {
  test('k-fade-in keyframe exists', () => {
    assert.ok(css.includes('@keyframes k-fade-in'), 'k-fade-in keyframe not found');
  });

  test('k-fade-in-scale keyframe exists', () => {
    assert.ok(css.includes('@keyframes k-fade-in-scale'), 'k-fade-in-scale keyframe not found');
  });

  test('k-slide-up keyframe exists', () => {
    assert.ok(css.includes('@keyframes k-slide-up'), 'k-slide-up keyframe not found');
  });

  test('k-screen-enter class exists', () => {
    assert.ok(css.includes('.k-screen-enter'), 'k-screen-enter class not found');
  });

  test('k-thinking class exists and uses pulse loop', () => {
    assert.ok(css.includes('.k-thinking'), 'k-thinking class not found');
    assert.ok(css.includes('k-pulse-glow'), 'k-thinking must use k-pulse-glow animation');
    assert.ok(css.includes('infinite'), 'k-thinking must be an infinite loop');
  });

  test('k-skeleton class exists and uses pulse loop', () => {
    assert.ok(css.includes('.k-skeleton'), 'k-skeleton class not found');
    assert.ok(css.includes('infinite'), 'k-skeleton must be an infinite loop');
  });

  test('k-pressable class exists with active scale', () => {
    assert.ok(css.includes('.k-pressable'), 'k-pressable class not found');
    assert.ok(css.includes('.k-pressable:active'), 'k-pressable:active not found');
    assert.ok(css.includes('scale(0.98)'), 'k-pressable active must use scale(0.98)');
  });

  test('k-alert-glow class exists and uses pulse loop', () => {
    assert.ok(css.includes('.k-alert-glow'), 'k-alert-glow class not found');
    assert.ok(css.includes('infinite'), 'k-alert-glow must be an infinite loop');
  });

  test('k-stagger class exists with delay for children', () => {
    assert.ok(css.includes('.k-stagger > *'), 'k-stagger children selector not found');
    assert.ok(css.includes('animation-delay: 50ms'), 'k-stagger must have 50ms delay on 2nd child');
  });
});

describe('Motion System — Motion Tokens', () => {
  test('--k-motion-fast token defined in :root', () => {
    assert.ok(css.includes('--k-motion-fast'), '--k-motion-fast not found');
  });

  test('--k-motion-base token defined in :root', () => {
    assert.ok(css.includes('--k-motion-base'), '--k-motion-base not found');
  });

  test('--k-motion-slow token defined in :root', () => {
    assert.ok(css.includes('--k-motion-slow'), '--k-motion-slow not found');
  });

  test('--k-ease-standard spring easing token defined', () => {
    assert.ok(css.includes('--k-ease-standard'), '--k-ease-standard not found');
    assert.ok(css.includes('cubic-bezier'), 'ease tokens must use cubic-bezier');
  });

  test('--k-ease-soft spring easing token defined', () => {
    assert.ok(css.includes('--k-ease-soft'), '--k-ease-soft not found');
  });
});

describe('Motion System — GPU Hints', () => {
  test('will-change applied to animated classes', () => {
    assert.ok(css.includes('will-change: transform, opacity'), 'will-change: transform, opacity not found');
  });

  test('transform: translateZ(0) GPU hint present', () => {
    assert.ok(css.includes('translateZ(0)'), 'translateZ(0) GPU hint not found');
  });

  test('backface-visibility: hidden applied', () => {
    assert.ok(css.includes('backface-visibility: hidden'), 'backface-visibility: hidden not found');
  });
});
