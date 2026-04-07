const test = require('node:test');
const assert = require('node:assert/strict');

const workoutBuilder = require('../../src/server/apihelpers/_workoutBuilder');
const diet = require('../../src/server/apihelpers/_diet');

test('workout builder creates a referenced 3-day split with exercises', () => {
  const plan = workoutBuilder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '3',
    tempo: '60 min',
    equipamentos: 'academia completa',
    limitacoes: 'nao',
    scientificConstraints: {
      evidenceReferences: [
        { title: 'Volume landmarks for hypertrophy', source: 'Sports Medicine' },
      ],
      referencedPlan: {
        treinos: [
          { nome: 'Treino A', grupo: 'peito/triceps', exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
          { nome: 'Treino B', grupo: 'costas/biceps', exercicios: [{ nome: 'Remada curvada', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
          { nome: 'Treino C', grupo: 'pernas', exercicios: [{ nome: 'Agachamento livre', series: 4, reps: '5-8', source_ref: 'ref-1' }] },
        ],
      },
    },
  });

  assert.equal(plan.failSafe, false);
  assert.equal(Array.isArray(plan.treinos), true);
  assert.equal(plan.treinos.length, 3);
  assert.ok(plan.treinos.every((treino) => Array.isArray(treino.exercicios) && treino.exercicios.length > 0));
  assert.equal(plan.references.length, 1);
  assert.equal(plan.orientacoes.objetivo, 'hipertrofia');
});

test('workout builder respects environment when explicit references are present', () => {
  const plan = workoutBuilder.buildWorkoutPlan({
    objetivo: 'definicao',
    nivel: 'iniciante',
    dias: '2',
    equipamentos: 'casa sem equipamento',
    limitacoes: 'nao',
    scientificConstraints: {
      evidenceReferences: [
        { title: 'Resistance training in constrained environments', source: 'NSCA' },
      ],
      referencedPlan: {
        treinos: [
          { nome: 'Treino A', grupo: 'full body', exercicios: [{ nome: 'Flexao de bracos', series: 3, reps: '12-15', source_ref: 'ref-2' }] },
          { nome: 'Treino B', grupo: 'full body', exercicios: [{ nome: 'Prancha', series: 3, reps: '30-45s', source_ref: 'ref-2' }] },
        ],
      },
    },
  });

  assert.equal(plan.failSafe, false);
  const exerciseNames = plan.treinos.flatMap((treino) => treino.exercicios.map((item) => item.nome.toLowerCase()));
  assert.ok(exerciseNames.some((name) => name.includes('flexao') || name.includes('prancha')));
});

test('workout builder uses catalog fallback when no template references provided', () => {
  // After the catalog-fallback fix, the builder generates a real workout
  // instead of returning failSafe:true when no Supabase templates exist.
  const plan = workoutBuilder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '3',
    equipamentos: 'academia completa',
    limitacoes: 'nao'
  });

  assert.equal(plan.failSafe, false);
  assert.equal(plan.flow_state, 'catalog_generated');
  assert.ok(plan.treinos.length > 0, 'deve gerar pelo menos um treino via catálogo');
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
