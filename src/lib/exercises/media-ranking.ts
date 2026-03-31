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
  let score = 0.2;

  const baseTokens = new Set([
    ...tokenize(exercise.name_en || ''),
    ...tokenize(exercise.name_pt || ''),
    ...tokenize(exercise.normalized_lookup_key || ''),
    ...tokenize(exercise.target_muscle || ''),
  ]);

  const metadataBlob = `${mediaCandidate.url} ${mediaCandidate.thumbnailUrl || ''} ${JSON.stringify(mediaCandidate.metadata || {})}`.toLowerCase();
  const overlap = Array.from(baseTokens).filter((token) => metadataBlob.includes(token)).length;
  if (baseTokens.size > 0) score += Math.min(0.28, (overlap / baseTokens.size) * 0.28);

  if (mediaCandidate.thumbnailUrl) score += 0.1;
  if (mediaCandidate.type === 'video') score += 0.16;
  if (mediaCandidate.type === 'gif') score += 0.08;

  const duration = Number((mediaCandidate.metadata?.duration as number) || 0);
  if (duration >= 8 && duration <= 90) score += 0.12;
  else if (duration > 90) score -= 0.05;

  const width = Number((mediaCandidate.metadata?.width as number) || 0);
  const height = Number((mediaCandidate.metadata?.height as number) || 0);
  if (width >= 640 && height >= 360) score += 0.1;

  if (/motivation|compilation|meme|edit|random|stock/i.test(metadataBlob)) score -= 0.2;
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}

export function pickBestExerciseMedia(
  exercise: Partial<ExerciseEntity>,
  pexelsCandidates: PexelsVideoItem[],
  currentMedia: { media_url?: string | null; media_type?: string | null; media_confidence_score?: number | null; gif_url?: string | null },
) {
  const currentScore = Number(currentMedia.media_confidence_score ?? 0);
  if (currentMedia.media_type === 'video' && currentMedia.media_url && currentScore >= 0.75) {
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
        metadata: { duration: video.duration, width: file?.width || video.width, height: file?.height || video.height, url: video.url },
      };
      return { video, candidate, score: computeMediaConfidenceScore(exercise, candidate) };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const gifFallback = currentMedia.gif_url || exercise.gif_url || null;
  if (!best || best.score < 0.67) {
    if (gifFallback) {
      return {
        media_url: gifFallback,
        media_thumbnail_url: gifFallback,
        media_type: 'gif' as const,
        media_provider: 'ExerciseDB',
        media_confidence_score: Number(Math.max(currentScore, 0.45).toFixed(4)),
        reason: 'kept_gif_fallback',
      };
    }
    return {
      media_url: currentMedia.media_url || null,
      media_thumbnail_url: exercise.media_thumbnail_url || null,
      media_type: (currentMedia.media_type as any) || null,
      media_provider: exercise.media_provider || null,
      media_confidence_score: Number(Math.max(currentScore, 0.2).toFixed(4)),
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
