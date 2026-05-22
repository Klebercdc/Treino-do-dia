import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalCatalogMedia } from '../../src/lib/exercises/local-catalog';

test('resolveLocalCatalogMedia encontra gif canônico para push up', () => {
  const match = resolveLocalCatalogMedia({
    name: 'Push Up',
    normalizedLookupKey: 'push_up',
    targetMuscle: 'chest',
    equipment: 'body weight',
  });

  assert.ok(match);
  assert.ok(match?.gifUrl?.includes('cdn.treino-do-dia.app/exercises/'));
  assert.equal(match?.normalizedLookupKey.includes('push_up'), true);
});

test('resolveLocalCatalogMedia converte shoulder press para overhead press com match válido', () => {
  const match = resolveLocalCatalogMedia({
    name: 'Shoulder Press',
    normalizedLookupKey: 'shoulder_press',
    targetMuscle: 'shoulders',
    equipment: 'dumbbell',
  });

  assert.ok(match);
  assert.ok(match?.gifUrl?.includes('cdn.treino-do-dia.app/exercises/'));
  assert.ok((match?.matchedBy || '').length > 0);
});

test('resolveLocalCatalogMedia usa alias seguro para pec deck', () => {
  const match = resolveLocalCatalogMedia({
    name: 'Pec Deck',
    normalizedLookupKey: 'pec_deck',
    targetMuscle: 'chest',
    equipment: 'machine',
  });

  assert.ok(match);
  assert.ok(match?.gifUrl?.includes('cdn.treino-do-dia.app/exercises/'));
});
