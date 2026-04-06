import type { DetectedExerciseContext, ExerciseEntity } from './types';

export const INTERNAL_EXERCISE_MEDIA_FALLBACK = '/Kronia.png';

const INVALID_MEDIA_HOSTS = new Set([
  'example.com',
  'www.example.com',
  'images.example.com',
  'via.placeholder.com',
  'placeholder.com',
  'localhost',
  '127.0.0.1',
]);

function normalizeToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlaceholderMediaUrl(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (/^data:/i.test(raw)) return false;
  if (raw.startsWith('/')) return false;

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return true;
    if (INVALID_MEDIA_HOSTS.has(url.hostname.toLowerCase())) return true;
    if (/example\.com/i.test(url.hostname)) return true;
    if (/placeholder|dummy|sample/i.test(url.pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

export function sanitizeMediaUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw || isPlaceholderMediaUrl(raw)) return null;
  return raw;
}

export function firstValidMediaUrl(...values: unknown[]): string | null {
  for (const value of values) {
    const sanitized = sanitizeMediaUrl(value);
    if (sanitized) return sanitized;
  }
  return null;
}

export function buildPexelsSearchQueries(
  exercise: Partial<ExerciseEntity>,
  context?: Partial<DetectedExerciseContext> | null,
): string[] {
  const rawName = normalizeToken(
    String(
      exercise.name_en
      || exercise.name_pt
      || context?.mentionedExercise
      || exercise.normalized_lookup_key
      || exercise.slug
      || '',
    ).replace(/[-_]+/g, ' '),
  );
  const firstToken = rawName.split(' ').find((token) => token.length >= 3) || '';
  const targetMuscle = normalizeToken(exercise.target_muscle || context?.targetMuscle || '');
  const equipment = normalizeToken(exercise.equipment || context?.equipment || '');

  const queries = [
    rawName,
    rawName.replace(/-/g, ' '),
    firstToken,
    firstToken ? `${firstToken} exercise` : '',
    firstToken ? `${firstToken} workout` : '',
    targetMuscle ? `${targetMuscle} exercise` : '',
    equipment ? `${equipment} exercise` : '',
  ]
    .map((item) => normalizeToken(item))
    .filter(Boolean);

  return Array.from(new Set(queries));
}

export function resolveExerciseMediaFields(exercise: Partial<ExerciseEntity>) {
  const mediaUrl = sanitizeMediaUrl(exercise.media_url);
  const gifUrl = sanitizeMediaUrl(exercise.gif_url);
  const imageUrl = sanitizeMediaUrl(exercise.image_url);
  const thumbnailUrl = firstValidMediaUrl(exercise.media_thumbnail_url, imageUrl, gifUrl);

  const explicitType = String(exercise.media_type || '').toLowerCase();
  let mediaType: 'video' | 'gif' | 'image' | 'none' = 'none';

  if (mediaUrl && explicitType === 'video') mediaType = 'video';
  else if (mediaUrl && /\.gif($|\?)/i.test(mediaUrl)) mediaType = 'gif';
  else if (mediaUrl) mediaType = explicitType === 'image' ? 'image' : 'video';
  else if (gifUrl) mediaType = 'gif';
  else if (imageUrl) mediaType = 'image';

  const primary = mediaUrl || gifUrl || imageUrl || INTERNAL_EXERCISE_MEDIA_FALLBACK;
  const fallback = gifUrl || imageUrl || INTERNAL_EXERCISE_MEDIA_FALLBACK;
  const provider =
    (mediaUrl && exercise.media_provider)
    || (gifUrl ? 'ExerciseDB' : null)
    || (imageUrl ? 'catalog' : null)
    || 'internal';

  return {
    mediaUrl,
    gifUrl,
    imageUrl,
    thumbnailUrl,
    primary,
    fallback,
    provider: String(provider || 'internal'),
    mediaType,
    hasRenderableMedia: Boolean(mediaUrl || gifUrl || imageUrl),
  };
}
