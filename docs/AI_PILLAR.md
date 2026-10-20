# AI pillar

Disabled by default (`AI_ENABLED=false`). `src/modules/ai/ports.ts` defines `LlmProvider`, `Embedder`, `VectorStore`, `Retriever`, `RagPipeline` and `Evaluator`. `AiRegistry` holds adapters; `/api/v1/ai/status` reports what is available. `InMemoryVectorStore` is a reference adapter for tests.

## RAG over the research references
Write an `Embedder` and `LlmProvider` adapter for your provider, index `content/references.json` and pack notes into a `VectorStore`, and implement `RagPipeline` using them. Register in `composition.ts` via `aiAdapters`.

## LangChain.js
Wrap LangChain retrievers and chat models in adapters that implement `Retriever` and `LlmProvider`. Keep LangChain inside the adapter so the rest of the app never imports it.

## RAGAS
RAGAS is a Python library. Run it as a small sidecar service and implement `Evaluator` as an HTTP client that sends question, answer and contexts and returns the metrics.

## Safeguards
Never send patient answers to a third-party model without consent and a data agreement. Never present model output as diagnosis. Keep humans in the loop.
