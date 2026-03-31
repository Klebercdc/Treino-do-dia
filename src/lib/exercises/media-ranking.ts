import type { PexelsVideoItem } from './types';

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

const NEGATIVE_TOKENS = ['motivation', 'compilation', 'edit', 'meme', 'funny', 'fail'];

export function rankPexelsVideo(
  video: PexelsVideoItem,
  context: { exerciseName: string; query: string; targetMuscle?: string | null; equipment?: string | null },
): number {
  const tokens = new Set([...tokenize(context.exerciseName), ...tokenize(context.query), ...tokenize(context.targetMuscle || ''), ...tokenize(context.equipment || '')]);
  const metadataBlob = `${video.url || ''} ${video.user?.name || ''}`.toLowerCase();
  let score = 0.32;

  const overlap = Array.from(tokens).filter((t) => metadataBlob.includes(t)).length;
  if (tokens.size) score += Math.min(0.28, (overlap / tokens.size) * 0.28);

  if (video.duration >= 8 && video.duration <= 70) score += 0.2;
  else if (video.duration <= 120) score += 0.08;

  if (video.width >= 720 && video.height >= 960) score += 0.16;
  if (video.width >= 1080 || video.height >= 1080) score += 0.08;

  if (NEGATIVE_TOKENS.some((token) => metadataBlob.includes(token))) score -= 0.22;

  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}

export function selectBestVideo(videos: PexelsVideoItem[], context: Parameters<typeof rankPexelsVideo>[1]) {
  const ranked = videos
    .map((video) => ({ video, score: rankPexelsVideo(video, context) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] ?? null;
  return {
    best,
    confidence: best?.score ?? 0,
    accepted: Boolean(best && best.score >= 0.67),
  };
}
