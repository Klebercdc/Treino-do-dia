const test = require('node:test');
const assert = require('node:assert/strict');

const workoutService = require('../../src/services/workout/workoutService');

test('workoutService builds workout plan only when explicit references are present', async () => {
  const result = await workoutService.execute('GENERATE_WORKOUT', {
    objective: 'hipertrofia',
    level: 'intermediario',
    days_per_week: 4,
    environment: 'academia completa',
    restrictions: ['joelho'],
    notes: 'evitar sobrecarga excessiva',
    scientificConstraints: {
      evidenceReferences: [
        { title: 'Resistance training progression models', source: 'ACSM' },
      ],
      referencedPlan: {
        treinos: [
          { nome: 'Treino A', grupo: 'peito/triceps', exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
          { nome: 'Treino B', grupo: 'costas/biceps', exercicios: [{ nome: 'Remada curvada', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
          { nome: 'Treino C', grupo: 'pernas', exercicios: [{ nome: 'Agachamento livre', series: 4, reps: '5-8', source_ref: 'ref-1' }] },
          { nome: 'Treino D', grupo: 'ombros/abdomen', exercicios: [{ nome: 'Desenvolvimento com halteres', series: 3, reps: '8-10', source_ref: 'ref-1' }] },
        ],
      },
    },
  });

  assert.equal(result.domain, 'workout');
  assert.equal(result.success, true);
  assert.equal(result.payload.profile.objetivo, 'hipertrofia');
  assert.equal(result.payload.profile.dias, '4');
  assert.ok(Array.isArray(result.payload.plan.treinos));
  assert.equal(result.payload.plan.treinos.length, 4);
  assert.equal(result.payload.validation.missingEvidenceReferences, false);
});

test('workoutService refuses to build workout without references', async () => {
  const result = await workoutService.execute('GENERATE_WORKOUT', {
    objective: 'hipertrofia',
    level: 'intermediario',
    days_per_week: 4,
    environment: 'academia completa',
  });

  assert.equal(result.domain, 'workout');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'WORKOUT_TEMPLATE_MISSING');
  assert.equal(result.payload.plan.failSafe, true);
  assert.equal(result.payload.validation.missingEvidenceReferences, true);
  assert.equal(result.payload.validation.validationError, 'WORKOUT_TEMPLATE_MISSING');
});

test('workoutService analyze returns summary instead of raw stub payload', async () => {
  const result = await workoutService.execute('ANALYZE_WORKOUT', {
    objetivo: 'forca',
    nivel: 'avancado',
    dias: '3',
    equipamentos: 'halteres',
  });

  assert.equal(result.domain, 'workout');
  assert.equal(result.success, true);
  assert.equal(result.payload.summary.hasObjective, true);
  assert.equal(result.payload.summary.hasFrequency, true);
});
