import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RedisRestSessionRepository } from '../src/modules/sessions/redis-repository.js';
import type { Session } from '../src/modules/sessions/types.js';

/** Minimal in-process imitation of the Upstash REST protocol (POST a command array). */
function fakeUpstash(now: () => number) {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const calls: Array<Array<string | number>> = [];
  const fetcher = async (_url: string, init: { headers: Record<string, string>; body: string }) => {
    if (init.headers['authorization'] !== 'Bearer secret') {
      return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    }
    const [cmd, key, a, b, c] = JSON.parse(init.body) as Array<string | number>;
    calls.push(JSON.parse(init.body) as Array<string | number>);
    for (const [k, v] of store) if (v.expiresAt <= now()) store.delete(k);
    let result: unknown = null;
    if (cmd === 'SET') {
      assert.equal(b, 'PX');
      store.set(String(key), { value: String(a), expiresAt: now() + Number(c) });
      result = 'OK';
    } else if (cmd === 'GET') result = store.get(String(key))?.value ?? null;
    else if (cmd === 'DEL') result = store.delete(String(key)) ? 1 : 0;
    else if (cmd === 'SCAN') result = ['0', [...store.keys()]];
    else if (cmd === 'PING') result = 'PONG';
    return { ok: true, status: 200, json: async () => ({ result }) };
  };
  return { fetcher, calls };
}

const session = (id: string, expiresAt: string): Session => ({
  id,
  code: 'ABC123',
  packId: 'p',
  packVersion: '1',
  keyId: 'k',
  status: 'active',
  responses: {},
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  expiresAt,
});

describe('redis REST session repository', () => {
  it('stores with a TTL, reads, counts, deletes and expires', async () => {
    let t = Date.parse('2026-01-01T10:00:00.000Z');
    const fake = fakeUpstash(() => t);
    const repo = new RedisRestSessionRepository({ url: 'http://x', token: 'secret', clock: () => new Date(t), fetcher: fake.fetcher });

    await repo.create(session('a', '2026-01-01T11:00:00.000Z'));
    assert.equal(fake.calls[0]?.[4], 3_600_000, 'TTL equals time to expiry');
    assert.equal((await repo.get('a'))?.code, 'ABC123');
    assert.equal(await repo.count(), 1);
    await repo.save({ ...session('a', '2026-01-01T11:00:00.000Z'), status: 'completed' });
    assert.equal((await repo.get('a'))?.status, 'completed');
    assert.equal(await repo.get('missing'), undefined);
    assert.equal(await repo.delete('a'), true);
    assert.equal(await repo.delete('a'), false);

    await repo.create(session('b', '2026-01-01T10:30:00.000Z'));
    t += 31 * 60 * 1000;
    assert.equal(await repo.get('b'), undefined, 'expired by Redis TTL');
    assert.deepEqual(await repo.deleteExpired(), []);
    await repo.ping();
  });

  it('surfaces store errors instead of hiding them', async () => {
    const fake = fakeUpstash(() => 0);
    const repo = new RedisRestSessionRepository({ url: 'http://x', token: 'wrong', fetcher: fake.fetcher });
    await assert.rejects(repo.get('a'), /Session store error \(401\)/);
  });
});
