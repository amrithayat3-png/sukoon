import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composePlatform } from '../src/composition.js';
import { dispatch } from './helpers/dispatch.js';
import { testConfig } from './helpers/platform.js';

type Json = Record<string, unknown>;
const ADMIN = 'admin-key-admin-key-1';
const SECRET = 's'.repeat(40);

async function setup(extra: Record<string, string> = {}) {
  const clock = { now: new Date('2026-03-10T10:00:00.000Z') };
  const platform = await composePlatform(
    testConfig({ SAAS_MODE: 'true', AUTH_SECRET: SECRET, ADMIN_KEY: ADMIN, CLINICIAN_KEYS: '', SESSION_CREATE_LIMIT_PER_HOUR: '0', ...extra }),
    { clock: () => new Date(clock.now) },
  );
  const call = (method: string, url: string, token?: string, body?: unknown) =>
    dispatch(platform, { method, url, ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}), ...(body ? { body } : {}) });
  return { platform, call, clock };
}

async function newOrg(call: Awaited<ReturnType<typeof setup>>['call'], body: Json = { name: 'Calm Clinic', monthlySessionLimit: 2 }) {
  const res = await call('POST', '/api/v1/admin/orgs', ADMIN, body);
  assert.equal(res.status, 201);
  return res.body as Json;
}

async function signup(call: Awaited<ReturnType<typeof setup>>['call'], code: string, email = 'dr@example.com') {
  const res = await call('POST', '/api/v1/accounts/signup', undefined, { inviteCode: code, name: 'Dr A', email, password: 'longpassword1' });
  assert.equal(res.status, 201);
  return String((res.body as Json)['token']);
}

describe('SaaS mode', () => {
  it('requires the admin key for admin routes and a token for clinician routes', async () => {
    const { call } = await setup();
    assert.equal((await call('GET', '/api/v1/admin/orgs')).status, 401);
    assert.equal((await call('GET', '/api/v1/admin/orgs', 'wrong-admin-key-xxxx')).status, 401);
    assert.equal((await call('GET', '/api/v1/tracks')).status, 401);
    assert.equal(((await call('GET', '/api/v1/meta')).body as Json)['saas'], true);
  });

  it('lets an admin create an institute and a psychologist join with its invite code', async () => {
    const { call } = await setup();
    const org = await newOrg(call);
    const token = await signup(call, String(org['inviteCode']).toLowerCase());
    assert.equal((await call('GET', '/api/v1/tracks', token)).status, 200);
    const me = (await call('GET', '/api/v1/accounts/me', token)).body as Json;
    assert.equal((me['org'] as Json)['name'], 'Calm Clinic');
    assert.equal(JSON.stringify(me).includes('passwordHash'), false);
    const dup = await call('POST', '/api/v1/accounts/signup', undefined, { inviteCode: org['inviteCode'], name: 'X', email: 'DR@example.com', password: 'longpassword1' });
    assert.equal(dup.status, 409);
    assert.equal((await call('POST', '/api/v1/accounts/signup', undefined, { inviteCode: 'NOPE1234', name: 'X', email: 'x@example.com', password: 'longpassword1' })).status, 404);
  });

  it('signs in with the right password only', async () => {
    const { call } = await setup();
    const org = await newOrg(call);
    await signup(call, String(org['inviteCode']));
    assert.equal((await call('POST', '/api/v1/accounts/login', undefined, { email: 'dr@example.com', password: 'wrong-password' })).status, 401);
    const ok = await call('POST', '/api/v1/accounts/login', undefined, { email: 'dr@example.com', password: 'longpassword1' });
    assert.equal(ok.status, 200);
    assert.ok((ok.body as Json)['token']);
  });

  it('keeps one institute\'s sessions private from another', async () => {
    const { call } = await setup();
    const a = await signup(call, String((await newOrg(call))['inviteCode']), 'a@example.com');
    const b = await signup(call, String((await newOrg(call, { name: 'Other Institute' }))['inviteCode']), 'b@example.com');
    const created = (await call('POST', '/api/v1/sessions', a, { packId: 'adults-anger' })).body as Json;
    assert.equal((await call('GET', `/api/v1/sessions/${created['id']}`, b)).status, 404);
    assert.equal((await call('GET', `/api/v1/sessions/${created['id']}`, a)).status, 200);
  });

  it('enforces the monthly cap, pause and end date, and resets next month', async () => {
    const { call, clock } = await setup();
    const org = await newOrg(call, { name: 'Tiny', monthlySessionLimit: 2 });
    let token = await signup(call, String(org['inviteCode']));
    const make = () => call('POST', '/api/v1/sessions', token, { packId: 'adults-anger' });
    assert.equal((await make()).status, 201);
    assert.equal((await make()).status, 201);
    assert.equal((await make()).status, 403, 'third session is over the cap of 2');
    const list = ((await call('GET', '/api/v1/admin/orgs', ADMIN)).body as Json)['orgs'] as Json[];
    assert.equal(list[0]?.['sessionsThisMonth'], 3);

    await call('PUT', `/api/v1/admin/orgs/${org['id']}`, ADMIN, { monthlySessionLimit: 50, paused: true });
    assert.equal((await make()).status, 403, 'paused');
    await call('PUT', `/api/v1/admin/orgs/${org['id']}`, ADMIN, { paused: false, expiresAt: '2026-03-01T00:00:00.000Z' });
    assert.equal((await make()).status, 403, 'ended');
    await call('PUT', `/api/v1/admin/orgs/${org['id']}`, ADMIN, { expiresAt: null });
    assert.equal((await make()).status, 201, 'reopened');
    clock.now = new Date('2026-04-02T10:00:00.000Z');
    token = String(((await call('POST', '/api/v1/accounts/login', undefined, { email: 'dr@example.com', password: 'longpassword1' })).body as Json)['token']);
    assert.equal((await make()).status, 201, 'new month');
  });

  it('rejects tampered or expired tokens', async () => {
    const { call, clock } = await setup();
    const token = await signup(call, String((await newOrg(call))['inviteCode']));
    assert.equal((await call('GET', '/api/v1/tracks', `${token}x`)).status, 401);
    clock.now = new Date('2026-03-20T10:00:00.000Z');
    assert.equal((await call('GET', '/api/v1/tracks', token)).status, 401);
  });

  it('refuses to start without AUTH_SECRET', async () => {
    const { loadConfig } = await import('../src/config/env.js');
    assert.throws(() => loadConfig({ SAAS_MODE: 'true' }), /AUTH_SECRET/);
  });
});
