import test from 'node:test';
import assert from 'node:assert/strict';
import { pickBestExerciseMedia } from '../../src/lib/exercises/media-ranking';

test('pickBestExerciseMedia keeps real gif when pexels confidence is low', () => {
  const result = pickBestExerciseMedia(
    { name_en: 'push up', gif_url: 'https://cdn.exercisedb.dev/pushup.gif' } as any,
    [
      {
        id: 1,
        width: 640,
        height: 360,
        duration: 5,
        url: 'https://pexels.com/video/1',
        image: 'https://images.pexels.com/1.jpg',
        user: { name: 'Random Creator' },
        video_files: [{ id: 10, quality: 'sd', width: 640, height: 360, link: 'https://player.pexels.com/video-files/1.mp4' }],
      },
    ],
    { media_url: null, media_type: null, media_confidence_score: 0.1, gif_url: 'https://cdn.exercisedb.dev/pushup.gif' },
    'push up exercise',
  );

  assert.equal(result.media_type, 'gif');
  assert.equal(result.media_url, 'https://cdn.exercisedb.dev/pushup.gif');
  assert.equal(result.reason, 'low_confidence_external_video');
});

test('pickBestExerciseMedia rejects placeholder current media', () => {
  const result = pickBestExerciseMedia(
    { name_en: 'deadlift', gif_url: 'https://cdn.exercisedb.dev/deadlift.gif' } as any,
    [],
    { media_url: 'https://example.com/fake.mp4', media_type: 'video', media_confidence_score: 0.95, gif_url: 'https://cdn.exercisedb.dev/deadlift.gif' },
    'deadlift exercise',
  );

  assert.equal(result.media_type, 'gif');
  assert.equal(result.media_url, 'https://cdn.exercisedb.dev/deadlift.gif');
});
