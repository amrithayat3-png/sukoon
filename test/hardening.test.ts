import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composePlatform } from '../src/composition.js';
import { EncryptedSessionRepository } from '../src/modules/sessions/encrypted-repository.js';
import { MemorySessionRepository } from '../src/modules/sessions/memory-repository.js';
import { dispatch } from './helpers/dispatch.js';
import { createTestHarness, testConfig } from './helpers/platform.js';

type Json = Record<string, unknown>;

describe('resume support', () => {
  it('returns saved answers and alias with the session', async () => {
    const h = await createTestHarness();
    const created = (await h.call('POST', '/api/v1/sessions', { body: { packId: 'adults-stress-wellbeing', alias: 'AB' } })).body as Json;
    const id = String(created['id']);
    await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: { w1: 2, w2: 1 } } });
    const got = (await h.call('GET', `/api/v1/sessions/${id}`)).body as Json;
    assert.deepEqual(got['responses'], { w1: 2, w2: 1 });
    assert.equal(got['alias'], 'AB');
  });
});

describe('encryption at rest', () => {
  it('stores no readable answers and round-trips through the service', async () => {
    const inner = new MemorySessionRepository();
    const repo = new EncryptedSessionRepository(inner, 'x'.repeat(40));
    const platform = await composePlatform(testConfig(), { sessionRepo: repo });
    const created = (await dispatch(platform, { method: 'POST', url: '/api/v1/sessions', body: { packId: 'adults-stress-wellbeing', alias: 'Secret' }, headers: { authorization: 'Bearer test-key-one-aaaaaaaa' } })).body as Json;
    const id = String(created['id']);
    await dispatch(platform, { method: 'PUT', url: `/api/v1/sessions/${id}/responses`, body: { responses: { w1: 3 } }, headers: { authorization: 'Bearer test-key-one-aaaaaaaa' } });
    const raw = JSON.stringify(await inner.get(id));
    assert.ok(!raw.includes('Secret'));
    assert.ok(raw.includes('sealed'));
    const got = (await dispatch(platform, { method: 'GET', url: `/api/v1/sessions/${id}`, headers: { authorization: 'Bearer test-key-one-aaaaaaaa' } })).body as Json;
    assert.deepEqual(got['responses'], { w1: 3 });
    assert.equal(got['alias'], 'Secret');
  });

  it('fails to read with a different key', async () => {
    const inner = new MemorySessionRepository();
    const a = new EncryptedSessionRepository(inner, 'a'.repeat(40));
    const now = new Date().toISOString();
    await a.create({ id: 'i', code: 'c', packId: 'p', packVersion: '1', keyId: 'k', status: 'active', responses: { w1: 1 }, createdAt: now, updatedAt: now, expiresAt: now });
    await assert.rejects(new EncryptedSessionRepository(inner, 'b'.repeat(40)).get('i'));
  });
});

describe('session creation limit', () => {
  it('returns 429 after the hourly limit', async () => {
    const platform = await composePlatform(testConfig({ SESSION_CREATE_LIMIT_PER_HOUR: '2' }));
    const make = () => dispatch(platform, { method: 'POST', url: '/api/v1/sessions', body: { packId: 'adults-anger' }, headers: { authorization: 'Bearer test-key-one-aaaaaaaa' } });
    assert.equal((await make()).status, 201);
    assert.equal((await make()).status, 201);
    assert.equal((await make()).status, 429);
  });
});
