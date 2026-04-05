const test = require('node:test');
const assert = require('node:assert/strict');

const contract = require('../../src/server/apihelpers/_workoutRouteContract');

test('buildWorkoutRouteEnvelope emite workout_primary para plano completo', () => {
  const envelope = contract.buildWorkoutRouteEnvelope({
    action: 'GENERATE_WORKOUT',
    domain: 'workout',
    success: true,
    message: 'Treino gerado com 3 sessões.',
    errorCode: null,
    payload: {
      validation: { missingFields: [], missingEvidenceReferences: false },
      plan: {
        failSafe: false,
        treinos: [{ nome: 'Treino A', exercicios: [{ nome: 'Supino reto com barra' }] }],
        references: [{ title: 'ACSM' }],
      },
    },
  }, {
    requestId: 'req-w-1',
    userId: 'user-w-1',
    plan: 'PRO',
  });

  assert.equal(envelope.success, true);
  assert.equal(envelope.type, 'workout_primary');
  assert.equal(envelope.data.content[0].type, 'workout_primary');
  assert.equal(envelope.meta.renderMode, 'workout_primary');
});

test('buildWorkoutRouteEnvelope emite workout_failsafe para bloqueio referenciado', () => {
  const envelope = contract.buildWorkoutRouteEnvelope({
    action: 'GENERATE_WORKOUT',
    domain: 'workout',
    success: false,
    message: 'Treino não gerado.',
    errorCode: 'WORKOUT_REFERENCE_REQUIRED',
    payload: {
      validation: { missingFields: [], missingEvidenceReferences: true },
      plan: {
        failSafe: true,
        flow_state: 'referenced_prescription_required',
        treinos: [],
        references: [],
      },
    },
  }, {
    requestId: 'req-w-2',
    userId: 'user-w-2',
    plan: 'PRO',
  });

  assert.equal(envelope.success, true);
  assert.equal(envelope.type, 'workout_failsafe');
  assert.equal(envelope.state, 'validation_required');
  assert.equal(envelope.data.content[0].type, 'workout_failsafe');
});
