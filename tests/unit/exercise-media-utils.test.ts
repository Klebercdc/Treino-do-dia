import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPexelsSearchQueries, INTERNAL_EXERCISE_MEDIA_FALLBACK, isPlaceholderMediaUrl, resolveExerciseMediaFields } from '../../src/lib/exercises/media-utils';

test('isPlaceholderMediaUrl invalidates example.com placeholders', () => {
  assert.equal(isPlaceholderMediaUrl('https://example.com/fake.gif'), true);
  assert.equal(isPlaceholderMediaUrl('https://images.example.com/exercise.mp4'), true);
  assert.equal(isPlaceholderMediaUrl('https://cdn.pexels.com/video-files/123/demo.mp4'), false);
});

test('buildPexelsSearchQueries generates ordered fallback queries', () => {
  const queries = buildPexelsSearchQueries({
    name_en: 'leg-press',
    target_muscle: 'quadriceps',
    equipment: 'machine',
  });

  assert.deepEqual(queries, [
    'leg press',
    'leg',
    'leg exercise',
    'leg workout',
    'quadriceps exercise',
    'machine exercise',
  ]);
});

test('resolveExerciseMediaFields prioritizes valid video then gif then internal fallback', () => {
  const withVideo = resolveExerciseMediaFields({
    media_url: 'https://videos.pexels.com/123.mp4',
    media_type: 'video',
    gif_url: 'https://cdn.exercisedb.dev/demo.gif',
  });
  assert.equal(withVideo.primary, 'https://videos.pexels.com/123.mp4');
  assert.equal(withVideo.fallback, 'https://cdn.exercisedb.dev/demo.gif');
  assert.equal(withVideo.mediaType, 'video');

  const fallbackOnly = resolveExerciseMediaFields({
    media_url: 'https://example.com/fake.mp4',
    gif_url: 'https://example.com/fake.gif',
    image_url: null,
  });
  assert.equal(fallbackOnly.primary, INTERNAL_EXERCISE_MEDIA_FALLBACK);
  assert.equal(fallbackOnly.provider, 'internal');
  assert.equal(fallbackOnly.mediaType, 'none');
});
