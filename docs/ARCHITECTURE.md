# Architecture

Sukoon is a modular monolith. Each capability is a **pillar**: a module that exposes `routes()` and depends only on ports (interfaces), never on the web framework.

```
web/ (vanilla ES modules)  ->  Fastify adapter  ->  RouteDef handlers (pillars)
                                                      auth | health | catalog | scoring | sessions | audit | ai
composition.ts wires pillars to adapters (memory/file stores, scoring strategies, event bus)
```

## Pillars

| Pillar | Responsibility |
| --- | --- |
| auth | Bearer access keys, SHA-256 digests, constant-time compare, opaque key ids |
| catalog | Validated JSON content (tracks, packs, references), patient-safe views |
| scoring | One `ScoringStrategy` per activity format (checkin, scenario) |
| sessions | Lifecycle, ownership by key, TTL purge, erase |
| audit | Subscribes to events; logs ids only, never answers or aliases |
| ai | Ports for LLM, embeddings, vector store, retriever, RAG, evaluator. Off by default |
| health | `/health`, `/ready`, `/api/v1/meta` |

## Request flow

Fastify adapter authenticates, validates with zod inside handlers, calls services, and maps errors through `core/http.ts`. Handlers are plain functions, so tests dispatch them in-process (`test/helpers/dispatch.ts`) with no network.

## Privacy and security

- No patient identifiers. The optional alias is for initials or a nickname.
- Memory store by default; sessions expire (TTL, max 168 h) and a sweeper purges them.
- The patient view is built by allow-listing fields, so scoring, bands, guidance, flags and clinician notes cannot leak to the patient screen. A test enforces this.
- Sessions are owned by the creating key; other keys get 404.
- Helmet CSP, rate limiting (stricter on auth), `no-store` on API responses, 64 KB body limit.
- The client-side return PIN is a courtesy for the room, not a security control.

## Extension points

- **New activity format**: add a schema variant, a `ScoringStrategy`, a client renderer.
- **New store**: implement `SessionRepository` (Postgres, Redis) and pass it to `buildApp`.
- **New pillar**: implement `Pillar`, register in `composition.ts`.
- **Events**: subscribe to `session.created|completed|erased` (analytics, webhooks).

## Known limits

Scoring thresholds are provisional. The Fastify glue, helmet and rate-limit behaviour are covered by `test/fastify.test.ts`, which runs once dependencies are installed.
