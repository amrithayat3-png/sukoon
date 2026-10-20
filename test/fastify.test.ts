import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testConfig, KEY_ONE } from './helpers/platform.js';

/**
 * Exercises the real web server (Fastify adapter, security headers, static files,
 * error handler). It is skipped automatically when the web dependencies are not
 * installed, so the suite still runs in minimal environments.
 */
async function loadBuildApp() {
  try {
    return (await import('../src/app.js')).buildApp;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
}

describe('fastify web server', async () => {
  const buildApp = await loadBuildApp();
  const skip = buildApp ? false : 'fastify dependencies are not installed';

  it('serves health publicly and protects the API', { skip }, async () => {
    const app = await buildApp!({ config: testConfig({ RATE_LIMIT_PER_MINUTE: '1000' }) });
    try {
      const health = await app.inject({ method: 'GET', url: '/health' });
      assert.equal(health.statusCode, 200);

      const denied = await app.inject({ method: 'GET', url: '/api/v1/tracks' });
      assert.equal(denied.statusCode, 401);
      assert.equal(denied.json().error.code, 'UNAUTHORIZED');

      const allowed = await app.inject({
        method: 'GET',
        url: '/api/v1/tracks',
        headers: { authorization: `Bearer ${KEY_ONE}` },
      });
      assert.equal(allowed.statusCode, 200);
      assert.equal(allowed.headers['cache-control'], 'no-store');
      assert.ok(allowed.headers['x-request-id']);
      assert.ok(allowed.headers['content-security-policy']);
    } finally {
      await app.close();
    }
  });

  it('runs a session through HTTP including 204 deletes', { skip }, async () => {
    const app = await buildApp!({ config: testConfig({ RATE_LIMIT_PER_MINUTE: '1000' }) });
    const headers = { authorization: `Bearer ${KEY_ONE}` };
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        headers,
        payload: { packId: 'adults-stress-wellbeing' },
      });
      assert.equal(created.statusCode, 201);
      const id = created.json().id as string;

      const bad = await app.inject({
        method: 'PUT',
        url: `/api/v1/sessions/${id}/responses`,
        headers,
        payload: { responses: { w1: 99 } },
      });
      assert.equal(bad.statusCode, 400);

      const completeNoBody = await app.inject({ method: 'POST', url: `/api/v1/sessions/${id}/complete`, headers });
      assert.equal(completeNoBody.statusCode, 400, 'incomplete, but the bodyless POST itself must be accepted');

      const removed = await app.inject({ method: 'DELETE', url: `/api/v1/sessions/${id}`, headers });
      assert.equal(removed.statusCode, 204);
    } finally {
      await app.close();
    }
  });

  it('serves the web client and returns JSON 404s', { skip }, async () => {
    const app = await buildApp!({ config: testConfig() });
    try {
      const page = await app.inject({ method: 'GET', url: '/' });
      assert.equal(page.statusCode, 200);
      assert.match(page.headers['content-type'] ?? '', /text\/html/);
      const missing = await app.inject({ method: 'GET', url: '/api/v1/nope' });
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.json().error.code, 'NOT_FOUND');
    } finally {
      await app.close();
    }
  });

  it('rate limits repeated key guessing', { skip }, async () => {
    const app = await buildApp!({ config: testConfig() });
    try {
      let last = 0;
      for (let i = 0; i < 25; i += 1) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/verify',
          headers: { authorization: 'Bearer wrong-key-wrong-key-1' },
        });
        last = res.statusCode;
      }
      assert.equal(last, 429);
    } finally {
      await app.close();
    }
  });
});
