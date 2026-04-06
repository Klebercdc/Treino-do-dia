const test = require('node:test');
const assert = require('node:assert/strict');

const helper = require('../../src/server/apihelpers/_dietSupabaseContext');

test('enrichDietPayload merges Supabase profile into sparse request payload', () => {
  const result = helper.enrichDietPayload({
    objetivo: 'hipertrofia',
    profile: {
      preferencias: ['frango'],
    },
  }, {
    profile: {
      birth_date: '1995-04-04',
      sex: 'feminino',
      height_cm: 168,
      current_weight_kg: 64,
      activity_level: 'moderado',
      dietary_pattern: 'vegano',
      allergies: ['gluten'],
      intolerances: ['lactose'],
      liked_foods: ['tofu'],
      disliked_foods: ['brocolis'],
      clinical_notes: 'SOP',
    },
    bodyMetrics: {
      weight_kg: 63,
      body_fat_percent: 22,
    },
    nutritionGoals: {
      calories_target: 2100,
      protein_g: 130,
      carbs_g: 220,
      fat_g: 60,
    },
    supplements: [
      { supplement_name: 'creatina' },
    ],
  });

  assert.equal(result.sexo, 'feminino');
  assert.equal(result.peso, 63);
  assert.equal(result.altura, 168);
  assert.equal(result.gorduraCorporal, 22);
  assert.equal(result.padraoAlimentar, 'vegano');
  assert.deepEqual(result.restricoes, ['gluten', 'lactose']);
  assert.deepEqual(result.preferencias, ['tofu']);
  assert.deepEqual(result.alimentosEvitar, ['brocolis']);
  assert.deepEqual(result.suplementos, ['creatina']);
  assert.equal(result.profile.dietaryPattern, 'vegano');
  assert.equal(result.profile.bodyFatPercent, 22);
  assert.equal(result.nutritionGoals.calories_target, 2100);
});

test('enrichDietPayload inclui contexto clínico do exame válido mais recente', () => {
  const result = helper.enrichDietPayload({}, {
    profile: {
      birth_date: '1992-01-01',
      sex: 'masculino',
      height_cm: 180,
      current_weight_kg: 84,
      activity_level: 'ativo',
      objective: 'hipertrofia',
    },
    latestLabReport: {
      id: 'lab-1',
      parsed: { glucose: 108, hba1c: 5.9, potassium: 4.8, ldl: 120 },
      confidence: 0.67,
      isValid: true,
      mode: 'clinical',
      clinicalFlags: ['pre_diabetes', 'glycemic_risk'],
      criticalFlags: [],
      createdAt: '2026-04-06T10:00:00Z',
    },
  });

  assert.equal(result.labContext.id, 'lab-1');
  assert.equal(result.labContext.mode, 'clinical');
  assert.deepEqual(result.labContext.clinicalFlags, ['pre_diabetes', 'glycemic_risk']);
  assert.equal(result.profile.labContext.id, 'lab-1');
  assert.equal(result.context.labContext.id, 'lab-1');
});
