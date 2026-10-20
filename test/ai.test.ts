import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAiRegistry, InMemoryVectorStore } from '../src/modules/ai/index.js';
import type { LlmProvider } from '../src/modules/ai/index.js';
import { createTestHarness } from './helpers/platform.js';

describe('AI pillar', () => {
  it('reports everything unavailable by default', async () => {
    const h = await createTestHarness();
    const res = await h.call('GET', '/api/v1/ai/status');
    assert.equal(res.status, 200);
    const body = res.body as { enabled: boolean; capabilities: Record<string, boolean> };
    assert.equal(body.enabled, false);
    assert.ok(Object.values(body.capabilities).every((v) => v === false));
  });

  it('only exposes adapters when enabled', () => {
    const llm: LlmProvider = { name: 'stub', generate: async () => ({ text: 'ok' }) };
    const disabled = createAiRegistry({ enabled: false, adapters: { llm } });
    assert.equal(disabled.get('llm'), undefined);
    const enabled = createAiRegistry({ enabled: true, adapters: { llm } });
    assert.equal(enabled.get('llm')?.name, 'stub');
    assert.equal(enabled.status().capabilities.llm, true);
    assert.equal(enabled.status().capabilities.rag, false);
  });

  it('ranks by cosine similarity and honours metadata filters in the reference vector store', async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { id: 'a', text: 'sleep hygiene', embedding: [1, 0, 0], metadata: { track: 'adults' } },
      { id: 'b', text: 'exam stress', embedding: [0.9, 0.1, 0], metadata: { track: 'teens' } },
      { id: 'c', text: 'loneliness', embedding: [0, 1, 0], metadata: { track: 'adults' } },
    ]);
    const all = await store.query([1, 0, 0], 3);
    assert.deepEqual(
      all.map((r) => r.document.id),
      ['a', 'b', 'c'],
    );
    const adultsOnly = await store.query([1, 0, 0], 3, { track: 'adults' });
    assert.deepEqual(
      adultsOnly.map((r) => r.document.id),
      ['a', 'c'],
    );
    await store.delete(['a']);
    assert.equal((await store.query([1, 0, 0], 1))[0]?.document.id, 'b');
  });
});
