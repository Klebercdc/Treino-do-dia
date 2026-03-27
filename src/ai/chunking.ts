import type { ChunkedDocument } from "./types"

export function splitTextIntoChunks(input: {
  content: string
  maxChars?: number
  overlapChars?: number
  metadata?: Record<string, unknown>
}): ChunkedDocument[] {
  const content = input.content.trim()
  const maxChars = input.maxChars ?? 900
  const overlap = input.overlapChars ?? 120

  if (!content) return []

  const chunks: ChunkedDocument[] = []
  let start = 0
  let chunkIndex = 0

  while (start < content.length) {
    let end = Math.min(start + maxChars, content.length)
    if (end < content.length) {
      const nextBreak = content.lastIndexOf(" ", end)
      if (nextBreak > start + Math.floor(maxChars * 0.6)) end = nextBreak
    }

    const piece = content.slice(start, end).trim()
    if (piece) {
      chunks.push({
        chunkIndex,
        content: piece,
        metadata: input.metadata,
      })
      chunkIndex += 1
    }

    if (end >= content.length) break
    start = Math.max(0, end - overlap)
  }

  return chunks
}
