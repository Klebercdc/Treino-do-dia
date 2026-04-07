const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../../src/server/apihelpers/_workoutRouteHandler');

test('handler retorna workout_primary com prescrição referenciada', async () => {
  const result = await handler.processWorkoutRouteRequest({
    body: {
      action: 'GENERATE_WORKOUT',
      payload: {
        objective: 'hipertrofia',
        level: 'intermediario',
        days_per_week: 3,
        environment: 'academia completa',
        scientificConstraints: {
          evidenceReferences: [{ title: 'ACSM', source: 'Guideline' }],
          referencedPlan: {
            treinos: [
              { nome: 'Treino A', grupo: 'peito/triceps', exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
              { nome: 'Treino B', grupo: 'costas/biceps', exercicios: [{ nome: 'Remada curvada', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
              { nome: 'Treino C', grupo: 'pernas', exercicios: [{ nome: 'Agachamento livre', series: 4, reps: '5-8', source_ref: 'ref-1' }] },
            ],
          },
        },
      },
    },
    requestId: 'req-wh-1',
    userId: 'user-wh-1',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.type, 'workout_primary');
  assert.equal(result.body.data.content[0].data.failSafe, false);
});

test('handler gera via catálogo (workout_primary) quando sem referências/prescrição', async () => {
  // Novo comportamento: sem templates → gera do catálogo, não retorna failsafe
  const result = await handler.processWorkoutRouteRequest({
    body: {
      action: 'GENERATE_WORKOUT',
      payload: {
        objective: 'hipertrofia',
        level: 'intermediario',
        days_per_week: 3,
        environment: 'academia completa',
      },
    },
    requestId: 'req-wh-2',
    userId: 'user-wh-2',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.type, 'workout_primary');
  assert.equal(result.body.data.content[0].data.failSafe, false);
  assert.ok(result.body.data.content[0].data.treinos.length > 0, 'Deve ter treinos gerados');
});

test('handler aproveita scientificConstraints já enriquecidos com referencedPlan', async () => {
  const result = await handler.processWorkoutRouteRequest({
    body: {
      action: 'GENERATE_WORKOUT',
      payload: {
        objective: 'hipertrofia',
        level: 'intermediario',
        days_per_week: 3,
        environment: 'academia completa',
        scientificConstraints: {
          evidenceReferences: [{ title: 'ACSM', source: 'Guideline' }],
          referencedPlan: {
            treinos: [
              { nome: 'Treino A', grupo: 'peito/triceps', exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }] },
            ],
          },
        },
      },
    },
    requestId: 'req-wh-3',
    userId: 'user-wh-3',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.type, 'workout_primary');
  assert.equal(result.body.data.content[0].data.references.length, 1);
});

test('handler gera do catálogo quando template do Supabase esta ausente (WORKOUT_TEMPLATE_MISSING)', async () => {
  // Com o fix: WORKOUT_TEMPLATE_MISSING não impede a geração — usa catálogo interno
  const result = await handler.processWorkoutRouteRequest({
    body: {
      action: 'GENERATE_WORKOUT',
      payload: {
        objective: 'hipertrofia',
        level: 'intermediario',
        days_per_week: 3,
        environment: 'academia completa',
        scientificConstraints: {
          templateMetadata: {
            validationError: 'WORKOUT_TEMPLATE_MISSING',
          },
        },
      },
    },
    requestId: 'req-wh-4',
    userId: 'user-wh-4',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.type, 'workout_primary');
  assert.equal(result.body.data.content[0].data.failSafe, false);
  assert.ok(result.body.data.content[0].data.treinos.length > 0);
  // Metadado de template ainda é preservado no validation
  assert.equal(result.body.data.service.validation.validationError, 'WORKOUT_TEMPLATE_MISSING');
});

test('handler gera do catálogo quando template do Supabase esta invalido (INVALID_WORKOUT_TEMPLATE_SHAPE)', async () => {
  // Com o fix: template inválido também faz fallback para catálogo
  const result = await handler.processWorkoutRouteRequest({
    body: {
      action: 'GENERATE_WORKOUT',
      payload: {
        objective: 'hipertrofia',
        level: 'intermediario',
        days_per_week: 3,
        environment: 'academia completa',
        scientificConstraints: {
          templateMetadata: {
            validationError: 'INVALID_WORKOUT_TEMPLATE_SHAPE',
          },
          // evidenceReferences sem referencedPlan válido
          evidenceReferences: [{ title: 'ACSM', source: 'Guideline' }],
        },
      },
    },
    requestId: 'req-wh-5',
    userId: 'user-wh-5',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.type, 'workout_primary');
  assert.equal(result.body.data.content[0].data.failSafe, false);
  assert.equal(result.body.data.service.validation.validationError, 'INVALID_WORKOUT_TEMPLATE_SHAPE');
});
