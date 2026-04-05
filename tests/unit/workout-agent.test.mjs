import test from 'node:test';
import assert from 'node:assert/strict';

import { WorkoutAgent } from '../../src/lib/agents/workoutAgent.js';

test('WorkoutAgent refuses to generate workout without explicit references', async () => {
  const result = await WorkoutAgent.generate({ scientificConstraints: {} }, 'quero um treino');

  assert.equal(result.failSafe, true);
  assert.equal(result.flow_state, 'referenced_data_required');
  assert.deepEqual(result.references, []);
});

test('WorkoutAgent still blocks legacy automatic generation even when references exist', async () => {
  const result = await WorkoutAgent.generate({
    scientificConstraints: {
      evidenceReferences: [{ title: 'ACSM', source: 'Guideline' }],
    },
  }, 'quero um treino');

  assert.equal(result.failSafe, true);
  assert.equal(result.flow_state, 'manual_review_required');
  assert.equal(result.references.length, 1);
});
