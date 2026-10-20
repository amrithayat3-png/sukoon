import path from 'node:path';
import type { Config } from './config/env.js';
import { EventBus } from './core/events.js';
import type { Logger } from './core/logger.js';
import { noopLogger } from './core/logger.js';
import type { Pillar } from './core/pillar.js';
import type { Principal, RouteDef } from './core/route.js';
import { createAiPillar, createAiRegistry } from './modules/ai/index.js';
import type { AiAdapters } from './modules/ai/index.js';
import { attachAuditLog } from './modules/audit/index.js';
import { createAuthPillar, KeyRing } from './modules/auth/index.js';
import { createCatalogPillar } from './modules/catalog/index.js';
import { FileCatalogRepository } from './modules/catalog/repository.js';
import { CatalogService } from './modules/catalog/service.js';
import { createHealthPillar } from './modules/health/index.js';
import { CheckinScoring, ScenarioScoring, ScoringEngine } from './modules/scoring/index.js';
import { FileSessionRepository } from './modules/sessions/file-repository.js';
import { createSessionsPillar } from './modules/sessions/index.js';
import { RedisRestSessionRepository } from './modules/sessions/redis-repository.js';
import { MemorySessionRepository } from './modules/sessions/memory-repository.js';
import { RetentionSweeper } from './modules/sessions/retention.js';
import { SessionService } from './modules/sessions/service.js';
import type { SessionRepository } from './modules/sessions/types.js';

export interface ComposeOptions {
  clock?: () => Date;
  sessionRepo?: SessionRepository;
  logger?: Logger;
  /** Wire AI adapters here (LangChain.js, vendor SDKs, a RAGAS sidecar client). */
  aiAdapters?: AiAdapters;
}

export interface Platform {
  readonly config: Config;
  readonly routes: readonly RouteDef[];
  readonly pillars: readonly Pillar[];
  readonly sessions: SessionService;
  readonly catalog: CatalogService;
  readonly events: EventBus;
  authenticate(header: string | undefined): Principal;
  start(): void;
  stop(): Promise<void>;
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Composition root. The only place that knows which concrete classes implement which
 * ports. Everything else depends on interfaces, which is what keeps pillars swappable.
 * It is framework-free on purpose: the web server, the test dispatcher and any future
 * worker or CLI all assemble the same platform.
 */
export async function composePlatform(config: Config, options: ComposeOptions = {}): Promise<Platform> {
  const log = options.logger ?? noopLogger;
  const clock = options.clock ?? (() => new Date());

  const events = new EventBus((event, error) => log.error({ event, err: error }, 'Event handler failed'));
  attachAuditLog(events, log);

  const catalog = new CatalogService(await FileCatalogRepository.load(config.contentDir));
  const scoring = new ScoringEngine().register(new CheckinScoring()).register(new ScenarioScoring());

  const repo: SessionRepository =
    options.sessionRepo ??
    (config.storeDriver === 'file'
      ? await FileSessionRepository.open(path.join(config.dataDir, 'sessions.json'))
      : config.storeDriver === 'redis'
        ? createRedisRepo(config, clock)
        : new MemorySessionRepository());

  const sessions = new SessionService({ repo, catalog, scoring, events, clock, ttlMs: config.sessionTtlMs });
  const keyRing = new KeyRing(config.clinicianKeys);
  const ai = createAiRegistry({
    enabled: config.aiEnabled,
    ...(options.aiAdapters ? { adapters: options.aiAdapters } : {}),
  });
  const sweeper = new RetentionSweeper(sessions, SWEEP_INTERVAL_MS, log);

  const pillars: Pillar[] = [
    createHealthPillar({
      appName: config.appName,
      appVersion: config.appVersion,
      checks: [
        {
          name: 'catalog',
          run: () => {
            if (catalog.packCount() === 0) throw new Error('No activity packs loaded.');
          },
        },
        { name: 'sessionStore', run: async () => void (await repo.count()) },
      ],
    }),
    createAuthPillar(),
    createCatalogPillar(catalog),
    createSessionsPillar(sessions),
    createAiPillar(ai),
  ];

  const routes = pillars.flatMap((pillar) => pillar.routes());
  const keys = routes.map((route) => `${route.method} ${route.path}`);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate) throw new Error(`Duplicate route registered: ${duplicate}`);

  return {
    config,
    routes,
    pillars,
    sessions,
    catalog,
    events,
    authenticate: (header) => keyRing.authenticate(header),
    start: () => sweeper.start(),
    stop: async () => {
      sweeper.stop();
      await repo.close?.();
    },
  };
}

function createRedisRepo(config: Config, clock: () => Date): RedisRestSessionRepository {
  if (!config.redisUrl || !config.redisToken) {
    throw new Error('STORE_DRIVER=redis needs REDIS_REST_URL and REDIS_REST_TOKEN (or the Upstash / Vercel KV equivalents).');
  }
  return new RedisRestSessionRepository({ url: config.redisUrl, token: config.redisToken, clock });
}
