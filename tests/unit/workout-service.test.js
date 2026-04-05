const test = require('node:test');
const assert = require('node:assert/strict');

const workoutService = require('../../src/services/workout/workoutService');

test('workoutService normalizes mixed payload and builds workout plan', async () => {
  const result = await workoutService.execute('GENERATE_WORKOUT', {
    objective: 'hipertrofia',
    level: 'intermediario',
    days_per_week: 4,
    environment: 'academia completa',
    restrictions: ['joelho'],
    notes: 'evitar sobrecarga excessiva',
  });

  assert.equal(result.domain, 'workout');
  assert.equal(result.success, true);
  assert.equal(result.payload.profile.objetivo, 'hipertrofia');
  assert.equal(result.payload.profile.dias, '4');
  assert.ok(Array.isArray(result.payload.plan.treinos));
  assert.equal(result.payload.plan.treinos.length, 4);
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
