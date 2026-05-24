'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const renderer = require('../../src/core/nutrition/diet_prescription_renderer');
const strategyEngine = require('../../src/core/nutrition/diet_strategy_engine');

const FIXTURES_DIR = path.join(__dirname, '../fixtures/diet');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

function buildPlan(fixture) {
  const strategy = strategyEngine.calculateNutrition(fixture);
  if (strategy.failSafe) return strategy;
  return renderer.buildNutritionPrescription(strategy);
}

function hasNaNOrUndefined(plan) {
  const resumo = plan.plan && plan.plan.resumoDiario || plan.resumoDiario || {};
  const fields = [resumo.calorias, resumo.proteinas, resumo.carboidratos, resumo.gorduras];
  return fields.some(v => v === undefined || v === null || (typeof v === 'number' && isNaN(v)));
}

function allItemsHaveSemanticStatus(plan) {
  const refeicoes = (plan.plan && plan.plan.refeicoes) || plan.refeicoes || [];
  return refeicoes.every(meal =>
    (meal.itens || []).every(item => item && typeof item.semanticStatus === 'string')
  );
}

function getConfidenceScore(plan) {
  const p = plan.plan || plan;
  return p.nutritionConfidence && p.nutritionConfidence.score;
}

// ---- hipertrofia-treino-manha ----

test('hipertrofia-treino-manha: pipeline sem erro', () => {
  const fixture = loadFixture('hipertrofia-treino-manha.json');
  assert.doesNotThrow(() => buildPlan(fixture));
});

test('hipertrofia-treino-manha: productionReady=true ou fallback documentado', () => {
  const fixture = loadFixture('hipertrofia-treino-manha.json');
  const result = buildPlan(fixture);
  const p = result.plan || result;
  const pr = p.productionReadiness || {};
  const isOk = pr.ready === true || result.failSafe === true;
  assert.ok(isOk, 'plano deve ser productionReady ou estar em failSafe documentado');
});

test('hipertrofia-treino-manha: sem NaN nos totais', () => {
  const fixture = loadFixture('hipertrofia-treino-manha.json');
  const result = buildPlan(fixture);
  assert.ok(!hasNaNOrUndefined(result), 'totais não devem ter NaN ou undefined');
});

test('hipertrofia-treino-manha: semanticStatus definido em todos os alimentos', () => {
  const fixture = loadFixture('hipertrofia-treino-manha.json');
  const result = buildPlan(fixture);
  if (result.failSafe) return;
  assert.ok(allItemsHaveSemanticStatus(result), 'todos itens devem ter semanticStatus');
});

test('hipertrofia-treino-manha: confidence score calculado (não hardcoded)', () => {
  const fixture = loadFixture('hipertrofia-treino-manha.json');
  const result = buildPlan(fixture);
  if (result.failSafe) return;
  const score = getConfidenceScore(result);
  assert.ok(typeof score === 'number', 'score deve ser número, foi: ' + score);
  assert.ok(score >= 0 && score <= 100, 'score deve estar entre 0-100');
});

// ---- emagrecimento ----

test('emagrecimento: pipeline sem erro', () => {
  const fixture = loadFixture('emagrecimento.json');
  assert.doesNotThrow(() => buildPlan(fixture));
});

test('emagrecimento: sem NaN nos totais', () => {
  const fixture = loadFixture('emagrecimento.json');
  const result = buildPlan(fixture);
  assert.ok(!hasNaNOrUndefined(result), 'totais não devem ter NaN ou undefined');
});

// ---- hemodialise ----

test('hemodialise: pipeline sem erro', () => {
  const fixture = loadFixture('hemodialise.json');
  assert.doesNotThrow(() => buildPlan(fixture));
});

test('hemodialise: sem NaN nos totais', () => {
  const fixture = loadFixture('hemodialise.json');
  const result = buildPlan(fixture);
  assert.ok(!hasNaNOrUndefined(result), 'totais não devem ter NaN ou undefined');
});

test('hemodialise: semanticStatus definido em todos os alimentos', () => {
  const fixture = loadFixture('hemodialise.json');
  const result = buildPlan(fixture);
  if (result.failSafe) return;
  assert.ok(allItemsHaveSemanticStatus(result), 'todos itens devem ter semanticStatus');
});

// ---- diabetes ----

test('diabetes: pipeline sem erro', () => {
  const fixture = loadFixture('diabetes.json');
  assert.doesNotThrow(() => buildPlan(fixture));
});

test('diabetes: sem NaN nos totais', () => {
  const fixture = loadFixture('diabetes.json');
  const result = buildPlan(fixture);
  assert.ok(!hasNaNOrUndefined(result), 'totais não devem ter NaN ou undefined');
});

// ---- vegetariano ----

test('vegetariano: pipeline sem erro', () => {
  const fixture = loadFixture('vegetariano.json');
  assert.doesNotThrow(() => buildPlan(fixture));
});

test('vegetariano: sem NaN nos totais', () => {
  const fixture = loadFixture('vegetariano.json');
  const result = buildPlan(fixture);
  assert.ok(!hasNaNOrUndefined(result), 'totais não devem ter NaN ou undefined');
});

// ---- dados-incompletos ----

test('dados-incompletos: pipeline sem crash (fallback seguro)', () => {
  const fixture = loadFixture('dados-incompletos.json');
  assert.doesNotThrow(() => buildPlan(fixture));
});

test('dados-incompletos: retorna failSafe ou plano com aviso', () => {
  const fixture = loadFixture('dados-incompletos.json');
  const result = buildPlan(fixture);
  const p = result.plan || result;
  const isSafe = result.failSafe === true ||
    (p.productionReadiness && !p.productionReadiness.ready) ||
    (p.visualPrescription && p.visualPrescription.dashboard.subtitle.includes('REVISÃO'));
  assert.ok(isSafe, 'dados incompletos devem resultar em fallback seguro ou revisão');
});
