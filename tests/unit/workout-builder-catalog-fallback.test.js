/**
 * Testes de regressão para o fallback de catálogo do _workoutBuilder.
 *
 * Cobre os cenários de produção identificados no incidente:
 *   1. Geração normal com template referenciado (caminho primário)
 *   2. Geração via catálogo quando não há templates (novo fallback — era failSafe antes)
 *   3. failSafe real apenas quando faltam dados mínimos
 *   4. Normalização de aliases de campo (objetivo, level, dias)
 *   5. Restrições (limitações) respeitadas na geração standalone
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const builder = require('../../src/server/apihelpers/_workoutBuilder');

/* ── helpers ──────────────────────────────────────────── */
const VALID_REFERENCED_PLAN = {
  treinos: [
    { nome: 'Treino A', grupo: 'peito/triceps', exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
    { nome: 'Treino B', grupo: 'costas/biceps', exercicios: [{ nome: 'Remada curvada', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
  ],
};

const VALID_EVIDENCE = [{ title: 'Resistance training', source: 'ACSM', href: null }];

/* ── testes ───────────────────────────────────────────── */

test('buildWorkoutPlan usa template referenciado quando disponível', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '2',
    equipamentos: 'academia',
    scientificConstraints: {
      evidenceReferences: VALID_EVIDENCE,
      referencedPlan: VALID_REFERENCED_PLAN,
    },
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.flow_state, 'referenced_ready');
  assert.equal(result.treinos.length, 2);
  assert.equal(result.treinos[0].nome, 'Treino A');
  assert.equal(result.references.length, 1);
});

test('buildWorkoutPlan gera via catálogo quando não há template (sem failSafe)', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '3',
    equipamentos: 'academia',
    scientificConstraints: {},
  });

  assert.equal(result.failSafe, false, 'Não deve retornar failSafe:true com dados suficientes');
  assert.equal(result.flow_state, 'catalog_generated');
  assert.ok(result.treinos.length > 0, 'Deve gerar pelo menos um treino');
  result.treinos.forEach(function(t) {
    assert.ok(Array.isArray(t.exercicios) && t.exercicios.length > 0, 'Cada treino deve ter exercícios');
  });
  assert.deepEqual(result.references, [], 'Sem referências no modo catálogo');
});

test('buildWorkoutPlan gera via catálogo com objetivo forca', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'forca',
    nivel: 'avancado',
    dias: '4',
    equipamentos: 'academia',
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.flow_state, 'catalog_generated');
  assert.equal(result.treinos.length, 4);
  const firstEx = result.treinos[0].exercicios[0];
  assert.equal(firstEx.series, 5, 'Avançado forca → 5 séries');
  assert.equal(firstEx.reps, '3-5');
  assert.equal(firstEx.descanso, '180-240s');
  assert.ok(result.orientacoes.progressao);
  assert.match(result.orientacoes.progressao.regra, /carga/i);
});

test('buildWorkoutPlan gera via catálogo com ambiente casa_sem_equipamento', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'iniciante',
    dias: '3',
    equipamentos: 'sem equipamento',
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.orientacoes.ambiente, 'casa_sem_equipamento');
  // Exercícios devem ser do catálogo de casa
  const allExNames = result.treinos.flatMap(t => t.exercicios.map(e => e.nome));
  assert.ok(allExNames.some(n => /flexao|prancha|agachamento|avanco/i.test(n)), 'Deve incluir exercícios bodyweight');
});

test('buildWorkoutPlan retorna failSafe:true somente quando sem dados mínimos', () => {
  const result = builder.buildWorkoutPlan({});

  assert.equal(result.failSafe, true);
  assert.deepEqual(result.treinos, []);
});

test('buildWorkoutPlan respeita limitação de joelho no modo catálogo', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '3',
    equipamentos: 'academia',
    limitacoes: 'joelho',
  });

  assert.equal(result.failSafe, false);
  const allNames = result.treinos.flatMap(t => t.exercicios.map(e => e.nome.toLowerCase()));
  const hasRestricted = allNames.some(n => /agachamento|avanco|leg press/.test(n));
  assert.equal(hasRestricted, false, 'Exercícios de joelho não devem aparecer com restrição de joelho');
});

test('buildWorkoutPlan adapta prescrição de core no objetivo força', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'forca',
    nivel: 'intermediario',
    dias: '3',
    equipamentos: 'academia',
  });

  assert.equal(result.failSafe, false);
  const core = result.treinos
    .flatMap(t => t.exercicios)
    .find(e => /prancha/i.test(e.nome));

  assert.ok(core, 'Plano de força deve manter core quando split pedir abdomen');
  assert.equal(core.tipo, 'core_time');
  assert.equal(core.reps, '30-45s');
  assert.equal(core.descanso, '45-75s');
  assert.notEqual(core.reps, '4-6');
});

test('buildWorkoutPlan inclui descanso, RIR, progressão e substituições no catálogo', () => {
  const result = builder.buildWorkoutPlan({
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    dias: '4',
    equipamentos: 'academia',
  });

  assert.equal(result.failSafe, false);
  assert.ok(result.orientacoes.progressao);
  assert.match(result.orientacoes.progressao.modelo, /progressao/i);

  const exercises = result.treinos.flatMap(t => t.exercicios);
  assert.ok(exercises.length > 0);
  exercises.forEach((exercise) => {
    assert.ok(exercise.descanso, `${exercise.nome} deve ter descanso`);
    assert.ok(exercise.rir, `${exercise.nome} deve ter RIR/orientação de esforço`);
    assert.ok(Array.isArray(exercise.substituicoes), `${exercise.nome} deve ter substituições`);
  });
  assert.ok(exercises.some((exercise) => exercise.substituicoes.length > 0));
});

test('workoutService.execute também usa catálogo quando sem templates', async () => {
  const workoutService = require('../../src/services/workout/workoutService');
  const result = await workoutService.execute('GENERATE_WORKOUT', {
    objective: 'hipertrofia',
    level: 'intermediario',
    days_per_week: 3,
    environment: 'academia completa',
  });

  assert.equal(result.domain, 'workout');
  // Com o fix, o serviço não deve mais retornar failSafe quando há dados suficientes
  assert.equal(result.success, true, 'Deve ter sucesso mesmo sem templates Supabase');
  assert.ok(Array.isArray(result.payload.plan.treinos) && result.payload.plan.treinos.length > 0);
  assert.equal(result.payload.plan.failSafe, false);
});

test('workoutService.execute ainda retorna failSafe quando dados insuficientes', async () => {
  const workoutService = require('../../src/services/workout/workoutService');
  const result = await workoutService.execute('GENERATE_WORKOUT', {});

  assert.equal(result.domain, 'workout');
  assert.equal(result.success, false);
  assert.equal(result.payload.plan.failSafe, true);
});
