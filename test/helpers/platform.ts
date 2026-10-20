import type { Config } from '../../src/config/env.js';
import { loadConfig } from '../../src/config/env.js';
import type { Platform } from '../../src/composition.js';
import { composePlatform } from '../../src/composition.js';
import type { DispatchResponse } from './dispatch.js';
import { dispatch } from './dispatch.js';

export const KEY_ONE = 'test-key-one-aaaaaaaa';
export const KEY_TWO = 'test-key-two-bbbbbbbb';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    CLINICIAN_KEYS: `${KEY_ONE},${KEY_TWO}`,
    LOG_LEVEL: 'silent',
    SESSION_TTL_HOURS: '1',
    ...overrides,
  });
}

export interface TestHarness {
  platform: Platform;
  clock: { now: Date };
  call(
    method: string,
    url: string,
    options?: { key?: string | null; body?: unknown },
  ): Promise<DispatchResponse>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const clock = { now: new Date('2026-01-01T10:00:00.000Z') };
  const platform = await composePlatform(testConfig(), { clock: () => new Date(clock.now) });
  return {
    platform,
    clock,
    call: (method, url, options = {}) => {
      const key = options.key === undefined ? KEY_ONE : options.key;
      return dispatch(platform, {
        method,
        url,
        ...(key ? { headers: { authorization: `Bearer ${key}` } } : {}),
        ...(options.body !== undefined ? { body: options.body } : {}),
      });
    },
  };
}

/** Collects every property name in a JSON-like value. */
export function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      collectKeys(child, into);
    }
  }
  return into;
}
