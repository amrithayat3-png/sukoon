import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { TestHarness } from './helpers/platform.js';
import { collectKeys, createTestHarness, KEY_ONE, KEY_TWO } from './helpers/platform.js';

let h: TestHarness;
beforeEach(async () => {
  h = await createTestHarness();
});

type Json = Record<string, unknown>;
const asJson = (value: unknown): Json => value as Json;

async function startAdultSession(key?: string): Promise<{ id: string; total: number }> {
  const res = await h.call('POST', '/api/v1/sessions', {
    ...(key ? { key } : {}),
    body: { packId: 'adults-stress-wellbeing', alias: 'AB' },
  });
  assert.equal(res.status, 201);
  const body = asJson(res.body);
  return { id: String(body['id']), total: Number(body['total']) };
}

const allAnswers = (value: number): Json =>
  Object.fromEntries(['w1', 'w2', 'w3', 'm1', 'm2', 'm3', 'm4', 'p1', 'p2', 'p3', 's1', 's2', 's3', 't1', 't2', 't3'].map((k) => [k, value]));

describe('public endpoints', () => {
  it('serves health, readiness and meta without a key', async () => {
    assert.equal((await h.call('GET', '/health', { key: null })).status, 200);
    const ready = await h.call('GET', '/ready', { key: null });
    assert.equal(ready.status, 200);
    assert.equal(asJson(ready.body)['status'], 'ready');
    const meta = asJson((await h.call('GET', '/api/v1/meta', { key: null })).body);
    assert.equal(meta['appName'], 'Sukoon');
  });
});

describe('authentication', () => {
  it('rejects missing and wrong keys on protected routes', async () => {
    assert.equal((await h.call('GET', '/api/v1/tracks', { key: null })).status, 401);
    assert.equal((await h.call('GET', '/api/v1/tracks', { key: 'wrong-key-wrong-key-1' })).status, 401);
    const res = await h.call('GET', '/api/v1/tracks', { key: null });
    assert.equal(asJson(asJson(res.body)['error'])['code'], 'UNAUTHORIZED');
  });

  it('verifies a valid key and returns an opaque key id, never the key', async () => {
    const res = await h.call('POST', '/api/v1/auth/verify');
    assert.equal(res.status, 200);
    const body = asJson(res.body);
    assert.equal(body['ok'], true);
    assert.equal(String(body['keyId']).length, 8);
    assert.ok(!JSON.stringify(res.body).includes(KEY_ONE));
  });
});

describe('catalog', () => {
  it('lists tracks with pack counts and packs by track', async () => {
    const tracks = (asJson((await h.call('GET', '/api/v1/tracks')).body)['tracks'] as Json[]) ?? [];
    assert.equal(tracks.length, 4);
    assert.equal(tracks.find((t) => t['id'] === 'adults')?.['packCount'], 12);
    assert.equal(tracks.find((t) => t['id'] === 'kids')?.['packCount'], 0);
    assert.equal(tracks.find((t) => t['id'] === 'teens')?.['packCount'], 9);
    assert.equal(tracks.find((t) => t['id'] === 'seniors')?.['packCount'], 7);
    const packs = asJson((await h.call('GET', '/api/v1/tracks/teens/packs')).body)['packs'] as Json[];
    assert.ok(packs.some((p) => p['id'] === 'teens-pressure-and-peers'));
    assert.equal((await h.call('GET', '/api/v1/tracks/nope/packs')).status, 404);
  });

  it('returns a pack detail whose patient view carries no scoring material', async () => {
    const res = await h.call('GET', '/api/v1/packs/teens-pressure-and-peers');
    assert.equal(res.status, 200);
    const keys = collectKeys(asJson(res.body)['patientView']);
    for (const secret of ['points', 'note', 'keyMessage', 'discussion']) assert.equal(keys.has(secret), false, secret);
    assert.equal((await h.call('GET', '/api/v1/packs/missing-pack')).status, 404);
  });
});

describe('session lifecycle', () => {
  it('runs a check-in end to end and returns clinician results', async () => {
    const { id, total } = await startAdultSession();
    assert.equal(total, 16);

    const partial = await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: { w1: 2 } } });
    assert.equal(partial.status, 200);
    assert.equal(asJson(partial.body)['answered'], 1);

    const early = await h.call('POST', `/api/v1/sessions/${id}/complete`);
    assert.equal(early.status, 400);
    assert.equal((await h.call('GET', `/api/v1/sessions/${id}/results`)).status, 409);

    await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: allAnswers(2) } });
    const done = await h.call('POST', `/api/v1/sessions/${id}/complete`);
    assert.equal(done.status, 200);
    assert.equal(asJson(done.body)['status'], 'completed');

    const results = asJson((await h.call('GET', `/api/v1/sessions/${id}/results`)).body);
    const summary = asJson(results['results']);
    assert.equal((summary['domains'] as unknown[]).length, 5);
    assert.equal((summary['flags'] as unknown[]).length, 1, 'm4 answered above the lowest option');
    assert.equal(asJson(results['session'])['alias'], 'AB');

    const late = await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: { w1: 0 } } });
    assert.equal(late.status, 409, 'a completed session cannot be edited');
  });

  it('rejects invalid input with a validation error', async () => {
    const { id } = await startAdultSession();
    assert.equal((await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: { w1: 99 } } })).status, 400);
    assert.equal((await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: { ghost: 1 } } })).status, 400);
    assert.equal((await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: {} })).status, 400);
    assert.equal((await h.call('POST', '/api/v1/sessions', { body: { packId: 'Bad Id' } })).status, 400);
    assert.equal((await h.call('POST', '/api/v1/sessions', { body: { packId: 'no-such-pack' } })).status, 404);
    assert.equal((await h.call('GET', '/api/v1/sessions/not-a-uuid')).status, 400);
    const longAlias = await h.call('POST', '/api/v1/sessions', {
      body: { packId: 'adults-stress-wellbeing', alias: 'x'.repeat(41) },
    });
    assert.equal(longAlias.status, 400);
  });

  it('scores a scenario session', async () => {
    const created = await h.call('POST', '/api/v1/sessions', { body: { packId: 'teens-pressure-and-peers' } });
    const id = String(asJson(created.body)['id']);
    await h.call('PUT', `/api/v1/sessions/${id}/responses`, {
      body: { responses: { 'family-comparison': 'a', 'just-once': 'b', 'friend-distance': 'c' } },
    });
    assert.equal((await h.call('POST', `/api/v1/sessions/${id}/complete`)).status, 200);
    const summary = asJson(asJson((await h.call('GET', `/api/v1/sessions/${id}/results`)).body)['results']);
    const bands = (summary['domains'] as Json[]).map((d) => d['band']);
    assert.deepEqual(bands, ['ok', 'watch', 'explore']);
  });

  it('hides one clinician\'s sessions from another', async () => {
    const { id } = await startAdultSession(KEY_ONE);
    assert.equal((await h.call('GET', `/api/v1/sessions/${id}`, { key: KEY_TWO })).status, 404);
    assert.equal((await h.call('DELETE', `/api/v1/sessions/${id}`, { key: KEY_TWO })).status, 404);
    assert.equal((await h.call('GET', `/api/v1/sessions/${id}`, { key: KEY_ONE })).status, 200);
  });

  it('erases a session on request', async () => {
    const { id } = await startAdultSession();
    assert.equal((await h.call('DELETE', `/api/v1/sessions/${id}`)).status, 204);
    assert.equal((await h.call('GET', `/api/v1/sessions/${id}`)).status, 404);
  });

  it('expires sessions after the retention period and purges them', async () => {
    const { id } = await startAdultSession();
    const second = await startAdultSession();
    h.clock.now = new Date(h.clock.now.getTime() + 61 * 60 * 1000);
    assert.equal((await h.call('GET', `/api/v1/sessions/${id}`)).status, 404, 'expired on access');
    assert.equal(await h.platform.sessions.purgeExpired(), 1, 'the untouched one is purged by the sweeper');
    assert.equal((await h.call('GET', `/api/v1/sessions/${second.id}`)).status, 404);
    assert.equal(await h.platform.sessions.purgeExpired(), 0);
  });

  it('publishes privacy-safe domain events', async () => {
    const seen: string[] = [];
    h.platform.events.on('session.created', (p) => seen.push(JSON.stringify(p)));
    const { id } = await startAdultSession();
    assert.equal(seen.length, 1);
    assert.ok(seen[0]?.includes(id));
    assert.ok(!seen[0]?.includes('AB'), 'alias must not appear in events');
  });
});

describe('routing', () => {
  it('returns a structured 404 for unknown routes', async () => {
    const res = await h.call('GET', '/api/v1/nothing-here');
    assert.equal(res.status, 404);
    assert.equal(asJson(asJson(res.body)['error'])['code'], 'NOT_FOUND');
  });
});

describe('open access mode', () => {
  it('lets anyone use the API without a key, while keys keep working', async () => {
    const { composePlatform } = await import('../src/composition.js');
    const { dispatch } = await import('./helpers/dispatch.js');
    const { testConfig } = await import('./helpers/platform.js');
    const platform = await composePlatform(testConfig({ OPEN_ACCESS: 'true', CLINICIAN_KEYS: '' }));
    const meta = await dispatch(platform, { method: 'GET', url: '/api/v1/meta' });
    assert.equal(asJson(meta.body)['openAccess'], true);
    const tracks = await dispatch(platform, { method: 'GET', url: '/api/v1/tracks' });
    assert.equal(tracks.status, 200);
    const created = await dispatch(platform, { method: 'POST', url: '/api/v1/sessions', body: { packId: 'adults-anger' } });
    assert.equal(created.status, 201);
  });

  it('is off by default and refuses production without keys unless enabled', async () => {
    const meta = asJson((await h.call('GET', '/api/v1/meta', { key: null })).body);
    assert.equal(meta['openAccess'], false);
    const { loadConfig } = await import('../src/config/env.js');
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /OPEN_ACCESS/);
    assert.equal(loadConfig({ NODE_ENV: 'production', OPEN_ACCESS: 'true' }).openAccess, true);
  });
});

describe('every shipped pack', () => {
  it('can be completed and scored end to end', async () => {
    const tracks = (asJson((await h.call('GET', '/api/v1/tracks')).body)['tracks'] as Json[]).map((t) => String(t['id']));
    let total = 0;
    for (const track of tracks) {
      const packs = asJson((await h.call('GET', `/api/v1/tracks/${track}/packs`)).body)['packs'] as Json[];
      for (const pack of packs) {
        const id = String(pack['id']);
        const detail = asJson((await h.call('GET', `/api/v1/packs/${id}`)).body);
        const view = asJson(detail['patientView']);
        const responses: Json = {};
        if (view['format'] === 'scenario') {
          for (const sc of view['scenarios'] as Json[]) responses[String(sc['id'])] = String(((sc['options'] as Json[])[0] as Json)['id']);
        } else {
          for (const item of view['items'] as Json[]) responses[String(item['id'])] = 1;
        }
        const created = asJson((await h.call('POST', '/api/v1/sessions', { body: { packId: id } })).body);
        const sid = String(created['id']);
        assert.equal((await h.call('PUT', `/api/v1/sessions/${sid}/responses`, { body: { responses } })).status, 200, id);
        assert.equal((await h.call('POST', `/api/v1/sessions/${sid}/complete`)).status, 200, id);
        const res = await h.call('GET', `/api/v1/sessions/${sid}/results`);
        assert.equal(res.status, 200, id);
        assert.ok(((asJson(asJson(res.body)['results'])['domains']) as unknown[]).length > 0, id);
        total += 1;
      }
    }
    assert.equal(total, 28);
  });
});
