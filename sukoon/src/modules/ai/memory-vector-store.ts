import type { ScoredDocument, VectorDocument, VectorStore } from './ports.js';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Reference implementation of the VectorStore port. Fine for tests and for a small
 * reference corpus. Replace with pgvector, Qdrant or similar behind the same port.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly documents = new Map<string, VectorDocument>();

  async upsert(documents: VectorDocument[]): Promise<void> {
    for (const document of documents) this.documents.set(document.id, document);
  }

  async query(
    embedding: number[],
    k: number,
    filter?: Record<string, string | number | boolean>,
  ): Promise<ScoredDocument[]> {
    const matches = [...this.documents.values()].filter((document) =>
      filter ? Object.entries(filter).every(([key, value]) => document.metadata[key] === value) : true,
    );
    return matches
      .map((document) => ({ document, score: cosine(embedding, document.embedding) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(0, k));
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.documents.delete(id);
  }
}
