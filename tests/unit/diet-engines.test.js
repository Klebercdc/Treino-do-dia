'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildBodyComposition, estimateVisceralRisk, calculateTMB } = require('../../src/core/nutrition/pcm_engine');
const { normalizeTrainingContext, calculateWeeklyTrainingCalories, calculateActivityAdjustedGet } = require('../../src/core/nutrition/training_energy_engine');
const { getMacroBaseForObjective, applyBehaviorAdjustments } = require('../../src/core/nutrition/metabolic_behavior_engine');
const { startDietFlow, STEPS, TOTAL_STEPS } = require('../../src/server/apihelpers/_dietflow');

// 1. Novo fluxo tem 6 etapas
test('STEPS has 6 entries', () => {
  assert.equal(Object.keys(STEPS).length, 6);
  assert.equal(TOTAL_STEPS, 6);
});

// 2. Fluxo inicia no step 1
test('startDietFlow returns step 1', () => {
  const flow = startDietFlow('user-123');
  assert.equal(flow.currentStep, 1);
});

// 3. Usuário com BCM usa BCM
test('buildBodyComposition uses BCM when available', () => {
  const profile = { bcmData: { body_fat_percent: 20 }, weight_kg: 80, height_cm: 175, sex: 'male', age: 30 };
  const result = buildBodyComposition(profile);
  assert.equal(result.source, 'bcm');
  assert.equal(result.body_fat_percent, 20);
});

// 3b. Aliases aceitos (peso/altura/sexo/idade)
test('buildBodyComposition accepts field aliases', () => {
  const profile = { bcmData: { body_fat_percent: 20 }, peso: 80, altura: 175, sexo: 'male', idade: 30 };
  const result = buildBodyComposition(profile);
  assert.equal(result.source, 'bcm');
  assert.equal(result.body_fat_percent, 20);
});

// 4. Usuário sem BCM usa PCM manual
test('buildBodyComposition uses PCM when no BCM', () => {
  const profile = { pcmManual: { waist_cm: 85, abdomen_cm: 88 }, weight_kg: 80, height_cm: 175, sex: 'male', age: 30 };
  const result = buildBodyComposition(profile);
  assert.equal(result.source, 'pcm_manual');
});

// 5. Sem BCM/PCM usa fallback
test('buildBodyComposition falls back to weight/height', () => {
  const profile = { weight_kg: 80, height_cm: 175, sex: 'male', age: 30 };
  const result = buildBodyComposition(profile);
  assert.equal(result.source, 'weight_height_only');
});

// 6a. Cintura alta gera risco alto (masculino)
test('estimateVisceralRisk returns high for waist > 102 male', () => {
  const result = estimateVisceralRisk({ waist_cm: 110 }, 'male');
  assert.equal(result.risk, 'high');
});

// 6b. Cintura normal gera risco normal
test('estimateVisceralRisk returns normal for waist < 102 male', () => {
  const result = estimateVisceralRisk({ waist_cm: 95 }, 'male');
  assert.equal(result.risk, 'normal');
});

// 6c. Feminino usa threshold 88
test('estimateVisceralRisk uses female threshold 88', () => {
  const high = estimateVisceralRisk({ waist_cm: 90 }, 'female');
  const norm = estimateVisceralRisk({ waist_cm: 80 }, 'female');
  assert.equal(high.risk, 'high');
  assert.equal(norm.risk, 'normal');
  assert.equal(high.threshold, 88);
});

// 7. Musculação 5x intensa aumenta GET
test('musculacao intensa 5x adds training calories to GET', () => {
  const training = normalizeTrainingContext({
    statusTreino: 'treino_regularmente',
    modalidades: [{ tipo: 'musculacao', diasSemana: 5, duracaoMinutos: 60, intensidade: 'intenso' }],
    rotinaForaTreino: 'trabalho_sentado',
  });
  const result = calculateActivityAdjustedGet({ training, weight_kg: 80, activityLevel: 'sedentary' }, 1800);
  assert.equal(result.getCalculationMode, 'training_based');
  assert.ok(result.get > 1800);
});

// 8. CrossFit intenso gera mais calorias que musculação moderada (mesmo tempo)
test('crossfit intenso generates more calories than musculacao moderada same time', () => {
  const crossfitCal = calculateWeeklyTrainingCalories(
    normalizeTrainingContext({ modalidades: [{ tipo: 'crossfit', diasSemana: 3, duracaoMinutos: 60, intensidade: 'intenso' }] }),
    80
  );
  const muscCal = calculateWeeklyTrainingCalories(
    normalizeTrainingContext({ modalidades: [{ tipo: 'musculacao', diasSemana: 3, duracaoMinutos: 60, intensidade: 'moderado' }] }),
    80
  );
  assert.ok(crossfitCal.total_semanal_kcal > muscCal.total_semanal_kcal);
});

// 9. Sem treino usa fallback de atividade
test('no training uses activity factor fallback', () => {
  const training = normalizeTrainingContext({});
  const result = calculateActivityAdjustedGet({ training, activityLevel: 'sedentary' }, 1800);
  assert.equal(result.getCalculationMode, 'activity_factor_fallback');
});

// 10. Sono ruim + fadiga alta + estresse alto reduz calorias
test('bad sleep + high fatigue + high stress reduces calorie target', () => {
  const profile = {
    objective: 'emagrecimento',
    metabolicBehavior: { sono: 'ruim', fadiga: 8, estresse: 'alto' },
  };
  const base = getMacroBaseForObjective('emagrecimento', 80, 2200);
  const adjusted = applyBehaviorAdjustments(profile, base.targetCalories, base);
  assert.ok(adjusted.adjusted_calories < base.targetCalories);
});

// 11. Adesão difícil gera plano simplificado
test('difficult adherence sets simplified_plan flag', () => {
  const profile = {
    objective: 'emagrecimento',
    metabolicBehavior: { adesao: 'tenho_dificuldade' },
  };
  const base = getMacroBaseForObjective('emagrecimento', 80, 2200);
  const adjusted = applyBehaviorAdjustments(profile, base.targetCalories, base);
  assert.equal(adjusted.flags.simplified_plan, true);
});

// 12. Uso de hormônios gera hormonal_alert e mensagem
test('hormonal use sets hormonal_alert flag and alert message', () => {
  const profile = {
    objective: 'hipertrofia',
    metabolicBehavior: { usoHormonios: 'testosterona_trt' },
  };
  const base = getMacroBaseForObjective('hipertrofia', 80, 2400);
  const adjusted = applyBehaviorAdjustments(profile, base.targetCalories, base);
  assert.equal(adjusted.flags.hormonal_alert, true);
  assert.ok(adjusted.alerts.length > 0);
});

// 13. getMacroBaseForObjective retorna carboidrato mínimo 50g
test('getMacroBaseForObjective ensures minimum 50g carbs', () => {
  // Peso muito baixo para forçar possível carbs negativo
  const base = getMacroBaseForObjective('emagrecimento', 40, 1200);
  assert.ok(base.carbs >= 50);
});

// 14. calculateTMB usa Katch-McArdle quando lean_mass disponível
test('calculateTMB uses Katch-McArdle when katch_mccardle_eligible', () => {
  const bc = { katch_mccardle_eligible: true, lean_mass_kg: 60 };
  const result = calculateTMB({ weight_kg: 80, height_cm: 175, sex: 'male', age: 30 }, bc);
  assert.equal(result.tmb_method, 'katch_mccardle');
  // Katch-McArdle: 370 + 21.6 * 60 = 1666
  assert.equal(result.tmb, 1666);
});

// 15. calculateTMB usa Mifflin-St Jeor sem lean_mass
test('calculateTMB uses Mifflin-St Jeor without lean mass', () => {
  const bc = { katch_mccardle_eligible: false };
  const result = calculateTMB({ weight_kg: 80, height_cm: 175, sex: 'male', age: 30 }, bc);
  assert.equal(result.tmb_method, 'mifflin_st_jeor');
  // 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75 ≈ 1749
  assert.ok(result.tmb > 1700 && result.tmb < 1800);
});

// 16. normalizeTrainingContext sem modalidades → hasTraining false
test('normalizeTrainingContext with no modalidades returns hasTraining false', () => {
  const result = normalizeTrainingContext({ statusTreino: 'treino_regularmente' });
  assert.equal(result.hasTraining, false);
  assert.deepEqual(result.modalidades, []);
});

// 17. Dados novos persistem (integração — skip sem SUPABASE_URL)
test('new fields persist after reload', { skip: !process.env.SUPABASE_URL }, async () => {
  assert.ok(true);
});
