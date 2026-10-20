import type { Embedder, Evaluator, LlmProvider, RagPipeline, Retriever, VectorStore } from './ports.js';

export interface AiAdapters {
  llm?: LlmProvider;
  embedder?: Embedder;
  vectorStore?: VectorStore;
  retriever?: Retriever;
  rag?: RagPipeline;
  evaluator?: Evaluator;
}

export type AiCapability = keyof AiAdapters;

const CAPABILITIES: readonly AiCapability[] = ['llm', 'embedder', 'vectorStore', 'retriever', 'rag', 'evaluator'];

/**
 * Holds whichever AI adapters have been wired. Consumers ask the registry, never a
 * concrete provider, and must handle the "not available" case. With nothing wired the
 * platform behaves exactly as it does without AI.
 */
export class AiRegistry {
  constructor(
    readonly enabled: boolean,
    private readonly adapters: AiAdapters = {},
  ) {}

  get<K extends AiCapability>(capability: K): AiAdapters[K] | undefined {
    return this.enabled ? this.adapters[capability] : undefined;
  }

  status(): { enabled: boolean; capabilities: Record<AiCapability, boolean> } {
    const capabilities = Object.fromEntries(
      CAPABILITIES.map((capability) => [capability, this.get(capability) !== undefined]),
    ) as Record<AiCapability, boolean>;
    return { enabled: this.enabled, capabilities };
  }
}

export function createAiRegistry(options: { enabled: boolean; adapters?: AiAdapters }): AiRegistry {
  return new AiRegistry(options.enabled, options.adapters);
}
