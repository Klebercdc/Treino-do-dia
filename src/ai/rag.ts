import type { RetrievedContextItem } from "./types"

export interface RagSearchInput {
  userId?: string
  query: string
  topK?: number
}

export interface RagProvider {
  search(input: RagSearchInput): Promise<RetrievedContextItem[]>
}

export class EmptyRagProvider implements RagProvider {
  async search(): Promise<RetrievedContextItem[]> {
    return []
  }
}
