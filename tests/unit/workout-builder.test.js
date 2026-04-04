const test = require('node:test');
const assert = require('node:assert/strict');

const workoutBuilder = require('../../src/server/apihelpers/_workoutBuilder');
const diet = require('../../src/server/apihelpers/_diet');

test('workout builder creates a 3-day split with exercises', () => {
  const plan = workoutBuilder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '3',
    tempo: '60 min',
    equipamentos: 'academia completa',
    limitacoes: 'nao'
  });

  assert.equal(Array.isArray(plan.treinos), true);
  assert.equal(plan.treinos.length, 3);
  assert.ok(plan.treinos.every((treino) => Array.isArray(treino.exercicios) && treino.exercicios.length > 0));
  assert.equal(plan.orientacoes.objetivo, 'hipertrofia');
});

test('workout builder respects environment fallback for no equipment', () => {
  const plan = workoutBuilder.buildWorkoutPlan({
    objetivo: 'definicao',
    nivel: 'iniciante',
    dias: '2',
    equipamentos: 'casa sem equipamento',
    limitacoes: 'nao'
  });

  const exerciseNames = plan.treinos.flatMap((treino) => treino.exercicios.map((item) => item.nome.toLowerCase()));
  assert.ok(exerciseNames.some((name) => name.includes('flexao') || name.includes('prancha')));
});

test('diet legacy builder returns meals for valid profile', () => {
  const plan = diet.buildDietPlan({
    sexo: 'masculino',
    idade: 30,
    peso: 80,
    altura: 175,
    objetivo: 'hipertrofia',
    rotina: 'academia 4x por semana',
    refeicoesPorDia: 4
  });

  assert.equal(plan.failSafe, false);
  assert.ok(Array.isArray(plan.refeicoes));
  assert.ok(plan.refeicoes.length >= 3);
  assert.ok(plan.meta.calorias > 0);
});
