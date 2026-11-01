import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composePlatform } from '../src/composition.js';
import { EncryptedSessionRepository } from '../src/modules/sessions/encrypted-repository.js';
import { MemorySessionRepository } from '../src/modules/sessions/memory-repository.js';
import { dispatch } from './helpers/dispatch.js';
import { createTestHarness, KEY_ONE, testConfig } from './helpers/platform.js';

type Json = Record<string, unknown>;
const ADMIN = 'admin-key-admin-key-1';
const SECRET = 's'.repeat(40);

async function finishedSession(h: Awaited<ReturnType<typeof createTestHarness>>, packId = 'adults-dass-21') {
  const created = (await h.call('POST', '/api/v1/sessions', { body: { packId, alias: 'AB' } })).body as Json;
  const id = String(created['id']);
  const detail = (await h.call('GET', `/api/v1/packs/${packId}`)).body as Json;
  const items = ((detail['patientView'] as Json)['items'] as Json[]).map((i) => String(i['id']));
  await h.call('PUT', `/api/v1/sessions/${id}/responses`, { body: { responses: Object.fromEntries(items.map((i) => [i, 1])) } });
  assert.equal((await h.call('POST', `/api/v1/sessions/${id}/complete`)).status, 200);
  return id;
}

describe('session extras: notes, homework, mood, body map, reflection, consent', () => {
  it('saves them and returns them with the results, with homework expanded to full cards', async () => {
    const h = await createTestHarness();
    const id = await finishedSession(h);
    const put = await h.call('PUT', `/api/v1/sessions/${id}/extras`, {
      body: { notes: '  Wants to talk about sleep.  ', homework: ['slow-breathing', 'three-good-things', 'slow-breathing'], moodStart: 'rainy', moodEnd: 'partly', reflection: 'calmer', bodyMap: ['chest', 'stomach'], consent: true },
    });
    assert.equal(put.status, 200);
    const results = ((await h.call('GET', `/api/v1/sessions/${id}/results`)).body as Json)['session'] as Json;
    assert.equal(results['notes'], 'Wants to talk about sleep.');
    assert.deepEqual((results['homework'] as Json[]).map((c) => c['id']), ['slow-breathing', 'three-good-things']);
    assert.ok(Array.isArray((results['homework'] as Json[])[0]!['steps']));
    assert.deepEqual(results['moodStart'], { id: 'rainy', label: 'Rainy' });
    assert.deepEqual(results['moodEnd'], { id: 'partly', label: 'A bit cloudy' });
    assert.deepEqual(results['reflection'], { id: 'calmer', label: 'I feel a bit calmer' });
    assert.deepEqual(results['bodyMap'], [{ id: 'chest', label: 'Chest' }, { id: 'stomach', label: 'Stomach' }]);
    assert.ok(results['consentAt']);
    // Clearing works.
    await h.call('PUT', `/api/v1/sessions/${id}/extras`, { body: { notes: '', homework: [] } });
    const cleared = ((await h.call('GET', `/api/v1/sessions/${id}/results`)).body as Json)['session'] as Json;
    assert.equal(cleared['notes'], undefined);
    assert.deepEqual(cleared['homework'], []);
  });

  it('rejects unknown ids, unknown fields and oversized notes', async () => {
    const h = await createTestHarness();
    const id = await finishedSession(h);
    const bad = (body: unknown) => h.call('PUT', `/api/v1/sessions/${id}/extras`, { body });
    assert.ok([400, 404].includes((await bad({ homework: ['not-a-card'] })).status));
    assert.equal((await bad({ moodStart: 'purple' })).status, 400);
    assert.equal((await bad({ bodyMap: ['elbow'] })).status, 400);
    assert.equal((await bad({ reflection: 'x' })).status, 400);
    assert.equal((await bad({ surprise: true })).status, 400);
    assert.equal((await bad({ notes: 'x'.repeat(4001) })).status, 400);
  });

  it('keeps one clinician out of another clinician\'s extras', async () => {
    const h = await createTestHarness();
    const id = await finishedSession(h);
    const res = await h.call('PUT', `/api/v1/sessions/${id}/extras`, { key: 'test-key-two-bbbbbbbb', body: { notes: 'x' } });
    assert.equal(res.status, 404);
  });

  it('seals notes and extras when encryption is on', async () => {
    const inner = new MemorySessionRepository();
    const platform = await composePlatform(testConfig(), { sessionRepo: new EncryptedSessionRepository(inner, 'x'.repeat(40)) });
    const auth = { authorization: `Bearer ${KEY_ONE}` };
    const created = (await dispatch(platform, { method: 'POST', url: '/api/v1/sessions', body: { packId: 'adults-dass-21' }, headers: auth })).body as Json;
    const id = String(created['id']);
    await dispatch(platform, { method: 'PUT', url: `/api/v1/sessions/${id}/extras`, body: { notes: 'Private worry about exams' }, headers: auth });
    const raw = JSON.stringify(await inner.get(id));
    assert.ok(!raw.includes('Private worry'));
    const back = (await dispatch(platform, { method: 'GET', url: `/api/v1/sessions/${id}`, headers: auth })).body as Json;
    assert.equal(back['id'], id);
  });
});

describe('resources', () => {
  it('serves homework to clinicians and the help page publicly', async () => {
    const h = await createTestHarness();
    const hw = (await h.call('GET', '/api/v1/homework')).body as Json;
    assert.ok((hw['cards'] as unknown[]).length >= 6);
    assert.equal((await h.call('GET', '/api/v1/homework', { key: null })).status, 401);
    const help = await h.call('GET', '/api/v1/help', { key: null });
    assert.equal(help.status, 200);
    assert.ok((help.body as Json)['intro']);
  });
});

describe('reviewed-only gate', () => {
  it('hides draft packs and refuses to start them when switched on', async () => {
    const platform = await composePlatform(testConfig({ ONLY_REVIEWED_PACKS: 'true' }));
    const auth = { authorization: `Bearer ${KEY_ONE}` };
    const tracks = ((await dispatch(platform, { method: 'GET', url: '/api/v1/tracks', headers: auth })).body as Json)['tracks'] as Json[];
    assert.ok(tracks.every((t) => t['packCount'] === 0));
    assert.deepEqual(((await dispatch(platform, { method: 'GET', url: '/api/v1/tracks/adults/packs', headers: auth })).body as Json)['packs'], []);
    assert.equal((await dispatch(platform, { method: 'GET', url: '/api/v1/packs/adults-dass-21', headers: auth })).status, 404);
    assert.equal((await dispatch(platform, { method: 'POST', url: '/api/v1/sessions', body: { packId: 'adults-dass-21' }, headers: auth })).status, 403);
    assert.equal(((await dispatch(platform, { method: 'GET', url: '/api/v1/meta' })).body as Json)['reviewedOnly'], true);
  });
});

describe('feedback, usage and password tools (SaaS)', () => {
  async function setup() {
    const platform = await composePlatform(testConfig({ SAAS_MODE: 'true', AUTH_SECRET: SECRET, ADMIN_KEY: ADMIN, CLINICIAN_KEYS: '', SESSION_CREATE_LIMIT_PER_HOUR: '0' }));
    const call = (method: string, url: string, token?: string, body?: unknown) =>
      dispatch(platform, { method, url, ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}), ...(body ? { body } : {}) });
    const org = (await call('POST', '/api/v1/admin/orgs', ADMIN, { name: 'Calm Clinic', monthlySessionLimit: 20 })).body as Json;
    const signup = (await call('POST', '/api/v1/accounts/signup', undefined, { inviteCode: org['inviteCode'], name: 'Dr A', email: 'dr@example.com', password: 'longpassword1' })).body as Json;
    return { call, org, token: String(signup['token']), userId: String((signup['user'] as Json)['id']) };
  }

  it('counts sessions per day and per activity without storing any answers', async () => {
    const { call, token } = await setup();
    const s = (await call('POST', '/api/v1/sessions', token, { packId: 'adults-dass-21' })).body as Json;
    await call('POST', '/api/v1/sessions', token, { packId: 'adults-dass-21' });
    const detail = (await call('GET', '/api/v1/packs/adults-dass-21', token)).body as Json;
    const ids = (((detail['patientView'] as Json)['items']) as Json[]).map((i) => String(i['id']));
    await call('PUT', `/api/v1/sessions/${String(s['id'])}/responses`, token, { responses: Object.fromEntries(ids.map((i) => [i, 0])) });
    await call('POST', `/api/v1/sessions/${String(s['id'])}/complete`, token);
    const usage = (await call('GET', '/api/v1/usage', token)).body as Json;
    assert.deepEqual(usage['totals'], { created: 2, completed: 1 });
    assert.equal(((usage['packs'] as Json[])[0] as Json)['packId'], 'adults-dass-21');
    const admin = (await call('GET', '/api/v1/admin/usage', ADMIN)).body as Json;
    assert.deepEqual(((admin['orgs'] as Json[])[0] as Json)['totals'], { created: 2, completed: 1 });
    assert.equal((await call('GET', '/api/v1/admin/usage', token)).status, 401);
  });

  it('stores feedback for the admin and limits input', async () => {
    const { call, token } = await setup();
    assert.equal((await call('POST', '/api/v1/feedback', token, { rating: 5, text: 'Clear and calm', page: 'results' })).status, 201);
    assert.equal((await call('POST', '/api/v1/feedback', token, { rating: 9 })).status, 400);
    const list = ((await call('GET', '/api/v1/admin/feedback', ADMIN)).body as Json)['feedback'] as Json[];
    assert.equal(list.length, 1);
    assert.equal(list[0]!['text'], 'Clear and calm');
    assert.equal((await call('GET', '/api/v1/admin/feedback', token)).status, 401);
  });

  it('lets the admin reset a password and the person change it', async () => {
    const { call, org, userId } = await setup();
    const users = ((await call('GET', `/api/v1/admin/orgs/${String(org['id'])}/users`, ADMIN)).body as Json)['users'] as Json[];
    assert.equal(users.length, 1);
    assert.equal(JSON.stringify(users).includes('passwordHash'), false);
    const reset = (await call('POST', `/api/v1/admin/users/${userId}/reset-password`, ADMIN)).body as Json;
    const temp = String(reset['temporaryPassword']);
    assert.ok(temp.length >= 10);
    assert.equal((await call('POST', '/api/v1/accounts/login', undefined, { email: 'dr@example.com', password: 'longpassword1' })).status, 401);
    const login = (await call('POST', '/api/v1/accounts/login', undefined, { email: 'dr@example.com', password: temp })).body as Json;
    const token = String(login['token']);
    assert.equal((await call('POST', '/api/v1/accounts/password', token, { current: 'wrong-wrong-1', next: 'brandnewpass1' })).status, 401);
    assert.equal((await call('POST', '/api/v1/accounts/password', token, { current: temp, next: 'brandnewpass1' })).status, 200);
    assert.equal((await call('POST', '/api/v1/accounts/login', undefined, { email: 'dr@example.com', password: 'brandnewpass1' })).status, 200);
    assert.equal((await call('POST', `/api/v1/admin/users/${userId}/reset-password`, token)).status, 401);
  });
});
