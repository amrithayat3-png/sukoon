import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, DEV_KEY, loadConfig } from '../src/config/env.js';

describe('configuration', () => {
  it('applies safe defaults in development and falls back to the dev key', () => {
    const config = loadConfig({});
    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.port, 3000);
    assert.equal(config.usingDevKey, true);
    assert.deepEqual(config.clinicianKeys, [DEV_KEY]);
    assert.equal(config.sessionTtlMs, 24 * 60 * 60 * 1000);
    assert.equal(config.aiEnabled, false);
  });

  it('refuses to start in production without clinician keys', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), ConfigError);
  });

  it('rejects short, duplicate and malformed values', () => {
    assert.throws(() => loadConfig({ CLINICIAN_KEYS: 'short' }), /at least 16/);
    assert.throws(() => loadConfig({ CLINICIAN_KEYS: 'a'.repeat(16) + ',' + 'a'.repeat(16) }), /duplicate/);
    assert.throws(() => loadConfig({ PORT: 'abc' }), ConfigError);
    assert.throws(() => loadConfig({ SESSION_TTL_HOURS: '1000' }), ConfigError);
  });

  it('parses a comma separated key list and the AI flag', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      CLINICIAN_KEYS: ` ${'a'.repeat(16)} , ${'b'.repeat(16)} `,
      AI_ENABLED: 'true',
    });
    assert.equal(config.clinicianKeys.length, 2);
    assert.equal(config.usingDevKey, false);
    assert.equal(config.aiEnabled, true);
  });

  it('reads Redis settings from generic, Upstash or Vercel KV variables', () => {
    const viaKv = loadConfig({ STORE_DRIVER: 'redis', KV_REST_API_URL: 'https://r.example', KV_REST_API_TOKEN: 't' });
    assert.equal(viaKv.storeDriver, 'redis');
    assert.equal(viaKv.redisUrl, 'https://r.example');
    assert.equal(viaKv.redisToken, 't');
  });
});
