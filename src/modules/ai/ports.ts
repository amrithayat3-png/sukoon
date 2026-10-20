/**
 * Ports for the AI pillar. These are interfaces only. Concrete adapters (LangChain.js,
 * a vendor SDK, a Python RAGAS sidecar, pgvector) live behind them, so swapping a
 * provider never touches pillars that consume AI.
 *
 * Rule for every adapter: patient responses and aliases must never be sent to a model,
 * an embedder or a vector store. Index reference material and clinician guidance only.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  readonly name: string;
  generate(request: {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }>;
}

export interface Embedder {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, string | number | boolean>;
}

export interface ScoredDocument {
  document: VectorDocument;
  score: number;
}

export interface VectorStore {
  upsert(documents: VectorDocument[]): Promise<void>;
  query(
    embedding: number[],
    k: number,
    filter?: Record<string, string | number | boolean>,
  ): Promise<ScoredDocument[]>;
  delete(ids: string[]): Promise<void>;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
  source: string;
}

export interface Retriever {
  retrieve(query: string, options?: { k?: number }): Promise<RetrievedChunk[]>;
}

export interface Citation {
  chunkId: string;
  source: string;
}

export interface RagAnswer {
  answer: string;
  citations: Citation[];
  /** The exact context passed to the model. Required so answers can be evaluated and audited. */
  contexts: string[];
}

export interface RagPipeline {
  answer(question: string, options?: { k?: number }): Promise<RagAnswer>;
}

/** One evaluation sample in the shape RAGAS-style metrics expect. */
export interface EvalSample {
  question: string;
  answer: string;
  contexts: string[];
  groundTruth?: string;
}

export interface EvalResult {
  /** Metric name to score between 0 and 1, for example faithfulness or answer_relevancy. */
  metrics: Record<string, number>;
}

export interface Evaluator {
  readonly name: string;
  evaluate(samples: EvalSample[]): Promise<EvalResult[]>;
}
