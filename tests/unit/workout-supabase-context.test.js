const test = require('node:test');
const assert = require('node:assert/strict');

const context = require('../../src/server/apihelpers/_workoutSupabaseContext');

test('resolveWorkoutTemplatePayload extracts referenced plan and evidence from stored templates', () => {
  const result = context.resolveWorkoutTemplatePayload([
    {
      id: 'tpl-1',
      name: 'Hipertrofia Base',
      evidenceReferences: [{ title: 'ACSM', source: 'Guideline' }],
      treinos: [
        {
          nome: 'Treino A',
          grupo: 'peito/triceps',
          exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }],
        },
      ],
    },
  ]);

  assert.equal(result.metadata.templateId, 'tpl-1');
  assert.equal(result.evidenceReferences.length, 1);
  assert.equal(result.referencedPlan.treinos.length, 1);
  assert.equal(result.referencedPlan.treinos[0].exercicios[0].nome, 'Supino reto com barra');
});

test('enrichWorkoutPayload injects referenced plan from supabase templates when payload is missing it', () => {
  const enriched = context.enrichWorkoutPayload({
    objetivo: 'hipertrofia',
    scientificConstraints: {},
  }, {
    workoutTemplates: [
      {
        id: 'tpl-1',
        references: [{ title: 'ACSM', source: 'Guideline' }],
        treinos: [
          {
            nome: 'Treino A',
            grupo: 'peito/triceps',
            exercicios: [{ nome: 'Supino reto com barra', series: 4, reps: '6-8', source_ref: 'ref-1' }],
          },
        ],
      },
    ],
  });

  assert.equal(enriched.scientificConstraints.evidenceReferences.length, 1);
  assert.equal(enriched.scientificConstraints.referencedPlan.treinos.length, 1);
  assert.equal(enriched.context.workoutTemplateMetadata.templateId, 'tpl-1');
});

test('resolveWorkoutTemplatePayload marks missing template when no candidate is available', () => {
  const result = context.resolveWorkoutTemplatePayload([]);

  assert.equal(result.referencedPlan, null);
  assert.equal(result.evidenceReferences.length, 0);
  assert.equal(result.metadata.validationError, 'WORKOUT_TEMPLATE_MISSING');
});

test('resolveWorkoutTemplatePayload marks invalid shape when template exists without valid treinos', () => {
  const result = context.resolveWorkoutTemplatePayload([
    {
      id: 'tpl-bad-1',
      name: 'Template quebrado',
      evidenceReferences: [{ title: 'ACSM', source: 'Guideline' }],
      treinos: [{ nome: 'Treino A', exercicios: [{}] }],
    },
  ]);

  assert.equal(result.referencedPlan, null);
  assert.equal(result.metadata.validationError, 'INVALID_WORKOUT_TEMPLATE_SHAPE');
});
