import path from 'node:path';
import { z } from 'zod';

const DEV_KEY = 'dev-only-clinician-key-do-not-use-in-production';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_NAME: z.string().trim().min(1).max(40).default('Sukoon'),
  APP_VERSION: z.string().default('dev'),
  CLINICIAN_KEYS: z.string().default(''),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(24),
  STORE_DRIVER: z.enum(['memory', 'file', 'redis']).default('memory'),
  REDIS_REST_URL: z.string().optional(),
  REDIS_REST_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  DATA_DIR: z.string().min(1).default('./data'),
  CONTENT_DIR: z.string().min(1).default('./content'),
  WEB_DIR: z.string().min(1).default('./web'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  AI_ENABLED: booleanString.default('false'),
});

export interface Config {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly appName: string;
  readonly appVersion: string;
  readonly clinicianKeys: readonly string[];
  readonly usingDevKey: boolean;
  readonly sessionTtlMs: number;
  readonly storeDriver: 'memory' | 'file' | 'redis';
  readonly redisUrl: string | undefined;
  readonly redisToken: string | undefined;
  readonly dataDir: string;
  readonly contentDir: string;
  readonly webDir: string;
  readonly rateLimitPerMinute: number;
  readonly aiEnabled: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid environment configuration. ${details}`);
  }
  const e = parsed.data;

  const configured = e.CLINICIAN_KEYS.split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  const tooShort = configured.filter((key) => key.length < 16);
  if (tooShort.length > 0) {
    throw new ConfigError('Every entry in CLINICIAN_KEYS must be at least 16 characters. Run: npm run keygen');
  }
  if (new Set(configured).size !== configured.length) {
    throw new ConfigError('CLINICIAN_KEYS contains duplicate entries.');
  }

  let clinicianKeys = configured;
  let usingDevKey = false;
  if (configured.length === 0) {
    if (e.NODE_ENV === 'production') {
      throw new ConfigError('CLINICIAN_KEYS is required in production. Run: npm run keygen');
    }
    clinicianKeys = [DEV_KEY];
    usingDevKey = true;
  }

  const resolve = (dir: string): string => path.resolve(process.cwd(), dir);

  return {
    nodeEnv: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    appName: e.APP_NAME,
    appVersion: e.APP_VERSION,
    clinicianKeys,
    usingDevKey,
    sessionTtlMs: Math.round(e.SESSION_TTL_HOURS * 60 * 60 * 1000),
    storeDriver: e.STORE_DRIVER,
    redisUrl: e.REDIS_REST_URL ?? e.UPSTASH_REDIS_REST_URL ?? e.KV_REST_API_URL,
    redisToken: e.REDIS_REST_TOKEN ?? e.UPSTASH_REDIS_REST_TOKEN ?? e.KV_REST_API_TOKEN,
    dataDir: resolve(e.DATA_DIR),
    contentDir: resolve(e.CONTENT_DIR),
    webDir: resolve(e.WEB_DIR),
    rateLimitPerMinute: e.RATE_LIMIT_PER_MINUTE,
    aiEnabled: e.AI_ENABLED,
  };
}

export { DEV_KEY };
