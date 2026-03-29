import type { ExerciseDbItem } from './types';

export class ExerciseDbClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://exercisedb.p.rapidapi.com',
    private readonly timeoutMs = 4500,
  ) {}

  async search(query: { name?: string; muscle?: string; equipment?: string }): Promise<ExerciseDbItem[]> {
    const endpoints: string[] = [];

    if (query.name) endpoints.push(`/exercises/name/${encodeURIComponent(query.name)}`);
    if (query.muscle) endpoints.push(`/exercises/target/${encodeURIComponent(query.muscle)}`);
    if (query.equipment) endpoints.push(`/exercises/equipment/${encodeURIComponent(query.equipment)}`);
    if (!endpoints.length) endpoints.push('/exercises?limit=20');

    for (const path of endpoints) {
      const response = await this.fetchWithTimeout(path);
      if (response.length) return response;
    }

    return [];
  }

  private async fetchWithTimeout(path: string): Promise<ExerciseDbItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
        signal: controller.signal,
      });

      if (!response.ok) return [];
      const payload = await response.json().catch(() => []);
      return Array.isArray(payload) ? (payload as ExerciseDbItem[]) : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
