'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const dietService = require('../../src/services/diet/dietService');
const nutritionService = require('../../src/lib/nutrition/nutritionService');
const { buildConditionFlags, buildClinicalContext } = require('../../src/core/nutrition/diet_context_clinical');
const dietRouteHandler = require('../../src/server/apihelpers/_dietRouteHandler');

// ─── buildConditionFlags ────────────────────────────────────────────────────

test('buildConditionFlags identifies Diabetes and Hipertensão correctly', () => {
  const flags = buildConditionFlags(['Diabetes', 'Hipertensão']);
  assert.equal(flags.hasDiabetes, true);
  assert.equal(flags.hasHipertensao, true);
  assert.equal(flags.hasDoencaRenal, false);
});

test('buildConditionFlags handles empty array gracefully', () => {
  const flags = buildConditionFlags([]);
  assert.equal(flags.hasDiabetes, false);
  assert.equal(flags.hasHipertensao, false);
  assert.deepEqual(flags.healthConditions, []);
});

test('buildConditionFlags handles null gracefully', () => {
  const flags = buildConditionFlags(null);
  assert.equal(flags.hasDiabetes, false);
  assert.equal(flags.hasHipertensao, false);
});

test('buildConditionFlags detects all supported conditions', () => {
  const flags = buildConditionFlags([
    'Diabetes',
    'Hipertensão',
    'Doença Renal',
    'Dislipidemia',
    'Gastrite',
    'Intolerância à lactose',
    'Gestação',
    'Pós-bariátrica',
  ]);
  assert.equal(flags.hasDiabetes, true);
  assert.equal(flags.hasHipertensao, true);
  assert.equal(flags.hasDoencaRenal, true);
  assert.equal(flags.hasDislipidemia, true);
  assert.equal(flags.hasGastriteRefluxo, true);
  assert.equal(flags.hasAlergiaIntolerancia, true);
  assert.equal(flags.hasGestacao, true);
  assert.equal(flags.hasPosBariatrica, true);
});

// ─── buildClinicalContext ───────────────────────────────────────────────────

test('buildClinicalContext extracts healthConditions from clinicalData at top level', () => {
  const ctx = buildClinicalContext({
    clinicalData: {
      healthConditions: ['Diabetes', 'Hipertensão'],
      bcmManual: null,
      exams: { useExistingExams: false },
    },
    saude: { patologia: 'nenhuma' },
  });

  assert.ok(ctx.clinicalData, 'clinicalData deve existir no contexto clínico');
  assert.deepEqual(ctx.clinicalData.healthConditions, ['Diabetes', 'Hipertensão']);
  assert.equal(ctx.clinicalData.flags.hasDiabetes, true);
  assert.equal(ctx.clinicalData.flags.hasHipertensao, true);
});

test('buildClinicalContext extracts healthConditions from saude.clinicalData', () => {
  const ctx = buildClinicalContext({
    saude: {
      patologia: 'Hipertensão',
      clinicalData: { healthConditions: ['Hipertensão'] },
    },
  });

  assert.equal(ctx.clinicalData.flags.hasHipertensao, true);
});

test('buildClinicalContext falls back to clinicalFlow.patologias when clinicalData missing', () => {
  const ctx = buildClinicalContext({
    clinicalFlow: { patologias: ['Diabetes'] },
  });

  assert.equal(ctx.clinicalData.flags.hasDiabetes, true);
});

// ─── normalizeDietPayload ───────────────────────────────────────────────────

test('normalizeDietPayload inclui clinicalData.healthConditions no payload normalizado', () => {
  const result = dietService.normalizeDietPayload({
    sexo: 'M',
    idade: 40,
    peso: 85,
    altura: 175,
    objetivo: 'emagrecimento',
    clinicalData: {
      healthConditions: ['Diabetes', 'Hipertensão'],
      bcmManual: null,
      exams: { useExistingExams: false },
    },
  });

  assert.ok(result.clinicalData, 'clinicalData deve estar presente no payload normalizado');
  assert.deepEqual(result.clinicalData.healthConditions, ['Diabetes', 'Hipertensão']);
  assert.equal(result.clinicalData.flags.hasDiabetes, true, 'flag hasDiabetes deve ser true');
  assert.equal(result.clinicalData.flags.hasHipertensao, true, 'flag hasHipertensao deve ser true');
});

test('normalizeDietPayload com clinicalData vazio retorna flags todas falsas', () => {
  const result = dietService.normalizeDietPayload({
    sexo: 'F',
    idade: 30,
    peso: 65,
    altura: 165,
    objetivo: 'manutencao',
    clinicalData: { healthConditions: [] },
  });

  assert.ok(result.clinicalData);
  assert.equal(result.clinicalData.flags.hasDiabetes, false);
  assert.equal(result.clinicalData.flags.hasHipertensao, false);
});

// ─── buildPayload (route handler) ──────────────────────────────────────────

test('buildPayload do route handler preserva clinicalData do body', () => {
  const body = {
    objetivo: 'emagrecimento',
    sexo: 'M',
    idade: 40,
    peso: 85,
    altura: 175,
    clinicalData: {
      healthConditions: ['Diabetes', 'Hipertensão'],
      bcmManual: null,
      exams: { useExistingExams: true },
    },
    aderencia: { modoAjuste: 'manual assistido' },
    nutritionFlowSelections: { proteinas: ['frango'] },
  };

  const payload = dietRouteHandler.buildPayload(body);

  assert.ok(payload.clinicalData, 'clinicalData deve estar presente no payload do route handler');
  assert.deepEqual(payload.clinicalData.healthConditions, ['Diabetes', 'Hipertensão']);
  assert.ok(payload.aderencia, 'aderencia deve estar presente');
  assert.ok(payload.nutritionFlowSelections, 'nutritionFlowSelections deve estar presente');
});

// ─── Full pipeline: Diabetes + Hipertensão → ajustesClinicosConsiderados ───

test('pipeline completo: Diabetes + Hipertensão produz ajustesClinicosConsiderados e clinicalNotes', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    sexo: 'M',
    idade: 50,
    peso: 90,
    altura: 174,
    objetivo: 'emagrecimento',
    refeicoesPorDia: 4,
    clinicalData: {
      healthConditions: ['Diabetes', 'Hipertensão'],
      bcmManual: null,
      exams: { useExistingExams: false },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.payload.plan.failSafe, false);

  const plan = result.payload.plan;

  // clinicalNotes devem mencionar as patologias
  const notesText = (plan.observacoes || []).concat(plan.clinicalNotes || []).join(' ');
  assert.ok(
    /diabet/i.test(notesText) || /glicemi/i.test(notesText),
    'clinicalNotes deve mencionar Diabetes ou controle glicêmico',
  );
  assert.ok(
    /hipertens/i.test(notesText) || /s[oó]dio/i.test(notesText),
    'clinicalNotes deve mencionar Hipertensão ou sódio',
  );
});

test('pipeline completo: Diabetes + Hipertensão — ajustesClinicosConsiderados presente no plano estruturado', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    sexo: 'F',
    idade: 45,
    peso: 78,
    altura: 162,
    objetivo: 'emagrecimento',
    refeicoesPorDia: 4,
    clinicalData: {
      healthConditions: ['Diabetes', 'Hipertensão'],
      bcmManual: null,
      exams: { useExistingExams: false },
    },
  });

  assert.equal(result.success, true);
  const plan = result.payload.plan;

  assert.ok(
    plan.ajustesClinicosConsiderados,
    'ajustesClinicosConsiderados deve estar presente quando há patologias',
  );
  const ajustes = plan.ajustesClinicosConsiderados.aplicados || [];
  const ajustesText = ajustes.join(' ');
  assert.ok(/diabet/i.test(ajustesText), 'ajustes devem mencionar Diabetes');
  assert.ok(/hipertens/i.test(ajustesText), 'ajustes devem mencionar Hipertensão');
  assert.ok(plan.ajustesClinicosConsiderados.alerta, 'alerta profissional deve estar presente');
});

test('pipeline completo: clinicalPromptBlock menciona Diabetes e Hipertensão', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    sexo: 'M',
    idade: 52,
    peso: 92,
    altura: 176,
    objetivo: 'manutencao',
    refeicoesPorDia: 5,
    clinicalData: {
      healthConditions: ['Diabetes', 'Hipertensão'],
      bcmManual: null,
      exams: { useExistingExams: false },
    },
  });

  assert.equal(result.success, true);
  const plan = result.payload.plan;

  assert.ok(plan.clinicalPromptBlock, 'clinicalPromptBlock deve estar presente');
  assert.ok(/Diabetes/i.test(plan.clinicalPromptBlock), 'prompt block deve conter "Diabetes"');
  assert.ok(/Hipertens/i.test(plan.clinicalPromptBlock), 'prompt block deve conter "Hipertensão"');
  assert.ok(/nutricionista/i.test(plan.clinicalPromptBlock), 'prompt block deve conter alerta profissional');
});

test('pipeline completo: sem patologias — ajustesClinicosConsiderados é null', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 178,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 4,
    clinicalData: { healthConditions: [] },
  });

  assert.equal(result.success, true);
  assert.ok(!result.payload.plan.ajustesClinicosConsiderados, 'ajustesClinicosConsiderados deve ser falsy quando sem patologias');
});

// ─── nutritionService direct ────────────────────────────────────────────────

test('nutritionService expõe ajustesClinicosConsiderados quando healthConditions declarado', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 48,
    peso: 72,
    altura: 163,
    objetivo: 'emagrecimento',
    refeicoesPorDia: 4,
    clinicalData: {
      healthConditions: ['Diabetes', 'Dislipidemia'],
      flags: { hasDiabetes: true, hasDislipidemia: true },
    },
  });

  assert.equal(result.failSafe, false);
  assert.ok(result.ajustesClinicosConsiderados, 'ajustesClinicosConsiderados deve existir');
  const ajustesText = result.ajustesClinicosConsiderados.aplicados.join(' ');
  assert.ok(/diabet/i.test(ajustesText));
  assert.ok(/dislipid/i.test(ajustesText));
});
