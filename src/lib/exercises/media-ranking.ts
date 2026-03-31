import type { ExerciseEntity, PexelsVideoItem } from './types';

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

export function computeMediaConfidenceScore(exercise: Partial<ExerciseEntity>, mediaCandidate: MediaCandidate): number {
  if (!mediaCandidate?.url) return 0;
  const blob = `${mediaCandidate.url} ${mediaCandidate.thumbnailUrl || ''} ${JSON.stringify(mediaCandidate.metadata || {})}`.toLowerCase();
  const tokens = Array.from(new Set([
    ...tokenize(exercise.normalized_lookup_key || ''),
    ...tokenize(exercise.name_pt || ''),
    ...tokenize(exercise.name_en || ''),
    ...tokenize(exercise.target_muscle || ''),
  ]));

  let score = mediaCandidate.type === 'video' ? 0.12 : mediaCandidate.type === 'gif' ? 0.3 : 0.08;
  const overlap = tokens.filter((token) => blob.includes(token)).length;
  if (tokens.length) score += Math.min(0.35, (overlap / tokens.length) * 0.35);

  const duration = Number(mediaCandidate.metadata?.duration || 0);
  if (mediaCandidate.type === 'video') {
    if (duration >= 6 && duration <= 50) score += 0.08;
    else if (duration > 90 || duration < 3) score -= 0.12;
  }

  const width = Number(mediaCandidate.metadata?.width || 0);
  const height = Number(mediaCandidate.metadata?.height || 0);
  if (width >= 640 && height >= 360) score += 0.06;

  if (/motivation|compilation|random|stock|meme|edit|broll|gym tour|workout music/i.test(blob)) score -= 0.28;
  if (overlap <= 1) score -= 0.18;
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}

export function pickBestExerciseMedia(
  exercise: Partial<ExerciseEntity>,
  pexelsCandidates: PexelsVideoItem[],
  currentMedia: { media_url?: string | null; media_type?: string | null; media_confidence_score?: number | null; gif_url?: string | null },
) {
  const currentScore = Number(currentMedia.media_confidence_score ?? 0);
  const currentType = String(currentMedia.media_type || '').toLowerCase();
  const gifFallback = currentMedia.gif_url || exercise.gif_url || (currentType === 'gif' ? currentMedia.media_url : null);

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

  if (currentType === 'video' && currentMedia.media_url && currentScore >= 0.8) {
    return {
      media_url: currentMedia.media_url,
      media_thumbnail_url: exercise.media_thumbnail_url || null,
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
        url: file?.link || null,
        thumbnailUrl: video.image || null,
        provider: 'Pexels',
        type: 'video',
        metadata: { duration: video.duration, width: file?.width || video.width, height: file?.height || video.height, url: video.url, creator: video.user?.name || '' },
      };
      return { candidate, score: computeMediaConfidenceScore(exercise, candidate) };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const threshold = 0.72;
  if (!best || best.score < threshold) {
    return {
      media_url: gifFallback || currentMedia.media_url || null,
      media_thumbnail_url: gifFallback || exercise.media_thumbnail_url || null,
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
  };
}
