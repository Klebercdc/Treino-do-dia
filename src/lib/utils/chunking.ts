export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = Math.max(300, options.chunkSize ?? 1200);
  const overlap = Math.max(50, Math.min(options.overlap ?? 200, chunkSize - 50));
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    const slice = normalized.slice(start, end);
    const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '), slice.lastIndexOf(' '));
    const finalEnd = end < normalized.length && boundary > 200 ? start + boundary + 1 : end;
    chunks.push(normalized.slice(start, finalEnd).trim());
    if (finalEnd >= normalized.length) break;
    start = Math.max(0, finalEnd - overlap);
  }

  return chunks.filter(Boolean);
}
