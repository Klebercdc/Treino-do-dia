const test = require('node:test');
const assert = require('node:assert/strict');

const workoutflow = require('../../src/server/apihelpers/_workoutflow');
const workoutBuilder = require('../../src/server/apihelpers/_workoutBuilder');
const workoutService = require('../../src/services/workout/workoutService');

test('buildWorkoutMessage returns the exact prebuilt workout JSON', () => {
  const message = workoutflow.buildWorkoutMessage({
    objetivo: 'hipertrofia',
    nivel: 'iniciante',
    dias: '3',
    tempo: '60 min',
    equipamentos: 'academia completa',
    limitacoes: 'nao',
  });

  assert.match(message, /^RETORNE EXATAMENTE O JSON ABAIXO\./);
  const jsonStart = message.indexOf('{');
  assert.ok(jsonStart > 0);
  const plan = JSON.parse(message.slice(jsonStart));
  assert.equal(plan.failSafe, false);
  assert.equal(plan.flow_state, 'catalog_generated');
  assert.equal(plan.treinos.length, 3);
});

test('buildWorkoutPlan normalizes wizard and alternate payload field names', () => {
  const plan = workoutBuilder.buildWorkoutPlan({
    goal: 'Hipertrofia',
    experienceLevel: 'Iniciante',
    frequency: 3,
    duration: '45 min',
    environment: 'academia completa',
    injuries: 'nao',
  });

  assert.equal(plan.failSafe, false);
  assert.equal(plan.orientacoes.objetivo, 'hipertrofia');
  assert.equal(plan.orientacoes.nivel, 'iniciante');
  assert.equal(plan.orientacoes.frequencia, '3x por semana');
  assert.equal(plan.treinos.length, 3);
});

test('workoutService accepts alternate payload aliases used by clients', async () => {
  const result = await workoutService.execute('GENERATE_WORKOUT', {
    goal: 'hipertrofia',
    experience: 'iniciante',
    days: 3,
    duration: '60 min',
    equipment: 'academia completa',
    limitations: 'nao',
  });

  assert.equal(result.success, true);
  assert.equal(result.payload.plan.failSafe, false);
  assert.equal(result.payload.plan.treinos.length, 3);
});

test('payload incompleto remains failsafe instead of producing empty successful plan', () => {
  const plan = workoutBuilder.buildWorkoutPlan({});

  assert.equal(plan.failSafe, true);
  assert.equal(Array.isArray(plan.treinos), true);
  assert.equal(plan.treinos.length, 0);
});
