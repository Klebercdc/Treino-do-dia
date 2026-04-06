import type { ExerciseEntity, PexelsVideoItem } from './types';
import { sanitizeMediaUrl } from './media-utils';

export type MediaCandidate = {
  url: string | null;
  thumbnailUrl: string | null;
  provider: string;
  type: 'video' | 'gif' | 'image' | 'none';
  metadata?: Record<string, unknown>;
};

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function computeMediaConfidenceScore(exercise: Partial<ExerciseEntity>, mediaCandidate: MediaCandidate, queryText = ''): number {
  if (!mediaCandidate?.url) return 0;
  const blob = `${mediaCandidate.url} ${mediaCandidate.thumbnailUrl || ''} ${JSON.stringify(mediaCandidate.metadata || {})} ${queryText}`.toLowerCase();
  const tokens = Array.from(new Set([
    ...tokenize(exercise.normalized_lookup_key || ''),
    ...tokenize(exercise.name_pt || ''),
    ...tokenize(exercise.name_en || ''),
    ...tokenize(exercise.target_muscle || ''),
  ]));

  let score = mediaCandidate.type === 'video' ? 0.08 : mediaCandidate.type === 'gif' ? 0.34 : 0.06;
  const overlap = tokens.filter((token) => blob.includes(token)).length;
  if (tokens.length) score += Math.min(0.32, (overlap / tokens.length) * 0.32);
  const queryTokens = tokenize(queryText);
  if (queryTokens.length >= 2) score += 0.18;
  else if (queryTokens.length === 1) score += 0.08;
  if (/(squat|deadlift|leg press|shoulder press|row|pull up|push up|chest press|lat pulldown|bench press)/i.test(queryText)) score += 0.08;

  const duration = Number(mediaCandidate.metadata?.duration || 0);
  if (mediaCandidate.type === 'video') {
    if (duration >= 8 && duration <= 45) score += 0.06;
    else if (duration > 75 || duration < 4) score -= 0.18;
  }

  const width = Number(mediaCandidate.metadata?.width || 0);
  const height = Number(mediaCandidate.metadata?.height || 0);
  if (width >= 640 && height >= 360) score += 0.04;

  if (/motivation|compilation|random|stock|meme|edit|broll|gym tour|workout music|vlog|challenge/i.test(blob)) score -= 0.34;
  if (/full body|fat burn|hiit|follow along|playlist/i.test(blob)) score -= 0.2;
  if (overlap <= 1) score -= 0.22;
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}

export function pickBestExerciseMedia(
  exercise: Partial<ExerciseEntity>,
  pexelsCandidates: PexelsVideoItem[],
  currentMedia: { media_url?: string | null; media_type?: string | null; media_confidence_score?: number | null; gif_url?: string | null },
  searchQuery = '',
) {
  const currentScore = Number(currentMedia.media_confidence_score ?? 0);
  const currentType = String(currentMedia.media_type || '').toLowerCase();
  const gifFallback = sanitizeMediaUrl(currentMedia.gif_url) || sanitizeMediaUrl(exercise.gif_url) || (currentType === 'gif' ? sanitizeMediaUrl(currentMedia.media_url) : null);
  const currentMediaUrl = sanitizeMediaUrl(currentMedia.media_url);

  if (currentType === 'gif' && gifFallback && currentScore >= 0.45) {
    return {
      media_url: gifFallback,
      media_thumbnail_url: gifFallback,
      media_type: 'gif' as const,
      media_provider: exercise.media_provider || 'ExerciseDB',
      media_confidence_score: Number(Math.max(0.45, currentScore).toFixed(4)),
      reason: 'kept_existing_gif',
    };
  }

  if (currentType === 'video' && currentMediaUrl && currentScore >= 0.8) {
    return {
      media_url: currentMediaUrl,
      media_thumbnail_url: sanitizeMediaUrl(exercise.media_thumbnail_url) || null,
      media_type: 'video' as const,
      media_provider: exercise.media_provider || 'catalog',
      media_confidence_score: currentScore,
      reason: 'kept_existing_video',
    };
  }

  const ranked = pexelsCandidates
    .map((video) => {
      const file = video.video_files?.find((v) => v.quality === 'sd') || video.video_files?.[0];
      const candidate: MediaCandidate = {
        url: sanitizeMediaUrl(file?.link) || null,
        thumbnailUrl: sanitizeMediaUrl(video.image) || null,
        provider: 'Pexels',
        type: 'video',
        metadata: { duration: video.duration, width: file?.width || video.width, height: file?.height || video.height, url: video.url, creator: video.user?.name || '', query: searchQuery },
      };
      return { candidate, score: computeMediaConfidenceScore(exercise, candidate, searchQuery) };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const threshold = 0.64;
  if (!best || best.score < threshold) {
    return {
      media_url: gifFallback || currentMedia.media_url || null,
      media_thumbnail_url: gifFallback || sanitizeMediaUrl(exercise.media_thumbnail_url) || null,
      media_type: gifFallback ? 'gif' as const : ((currentType || null) as any),
      media_provider: gifFallback ? 'ExerciseDB' : (exercise.media_provider || null),
      media_confidence_score: Number(Math.max(gifFallback ? 0.45 : 0.2, currentScore).toFixed(4)),
      reason: 'low_confidence_external_video',
    };
  }

  return {
    media_url: best.candidate.url,
    media_thumbnail_url: best.candidate.thumbnailUrl,
    media_type: 'video' as const,
    media_provider: 'Pexels',
    media_confidence_score: best.score,
    reason: 'selected_pexels_video',
    provider_media_id: String(pexelsCandidates.find((video) => {
      const file = video.video_files?.find((v) => v.quality === 'sd') || video.video_files?.[0];
      return sanitizeMediaUrl(file?.link) === best.candidate.url;
    })?.id ?? ''),
    width: Number(best.candidate.metadata?.width || 0) || null,
    height: Number(best.candidate.metadata?.height || 0) || null,
    duration: Number(best.candidate.metadata?.duration || 0) || null,
  };
}
