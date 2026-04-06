import test from 'node:test';
import assert from 'node:assert/strict';
import { ExerciseRepository } from '../../src/lib/exercises/repository';

test('repository mapExercise invalidates placeholder urls and preserves real gif', () => {
  const repository = new ExerciseRepository({} as any);
  const mapped = (repository as any).mapExercise({
    id: 'ex-1',
    slug: 'push-up',
    source: 'ExerciseDB',
    source_id: '1',
    name_pt: 'Flexão',
    name_en: 'Push Up',
    body_part: 'chest',
    target_muscle: 'peito',
    secondary_muscles: [],
    equipment: 'body weight',
    category: 'strength',
    instructions: [],
    gif_url: 'https://cdn.exercisedb.dev/pushup.gif',
    media_url: 'https://example.com/fake.mp4',
    media_thumbnail_url: 'https://example.com/thumb.jpg',
    media_type: 'video',
    media_provider: 'Pexels',
    image_url: null,
    search_terms: [],
    difficulty: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  assert.equal(mapped.media_url, null);
  assert.equal(mapped.gif_url, 'https://cdn.exercisedb.dev/pushup.gif');
  assert.equal(mapped.media_type, 'gif');
  assert.equal(mapped.media_thumbnail_url, 'https://cdn.exercisedb.dev/pushup.gif');
});
