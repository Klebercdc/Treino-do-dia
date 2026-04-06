import type { PexelsVideoItem } from './types';

export class PexelsClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.pexels.com/videos',
    private readonly timeoutMs = 3500,
  ) {}

  async searchVideos(query: string, perPage = 12): Promise<PexelsVideoItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
      const response = await fetch(url, {
        headers: { Authorization: this.apiKey },
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const payload = await response.json().catch(() => null);
      return Array.isArray(payload?.videos) ? (payload.videos as PexelsVideoItem[]) : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function scorePexelsVideo(video: PexelsVideoItem, context: { query: string; muscle?: string; equipment?: string }): number {
  let score = 0.35;
  const q = context.query.toLowerCase();
  const userName = video.user?.name?.toLowerCase() ?? '';

  if (q.includes('workout')) score += 0.1;
  if (context.muscle && q.includes(context.muscle)) score += 0.15;
  if (context.equipment && q.includes(context.equipment)) score += 0.15;
  if (video.duration >= 8 && video.duration <= 90) score += 0.1;
  if (video.width >= 720 && video.height >= 1280) score += 0.1;
  if (userName.includes('fitness') || userName.includes('gym')) score += 0.05;

  return Math.min(1, Number(score.toFixed(3)));
}
