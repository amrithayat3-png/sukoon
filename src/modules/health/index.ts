import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';

export interface HealthDeps {
  appName: string;
  appVersion: string;
  /** Readiness probes. Each must throw if its dependency is not usable. */
  checks: ReadonlyArray<{ name: string; run: () => void | Promise<void> }>;
}

export function createHealthPillar(deps: HealthDeps): Pillar {
  const startedAt = Date.now();
  return {
    name: 'health',
    routes(): RouteDef[] {
      return [
        {
          method: 'GET',
          path: '/health',
          auth: 'public',
          handler: () => ({ status: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) }),
        },
        {
          method: 'GET',
          path: '/ready',
          auth: 'public',
          handler: async () => {
            const results: Record<string, 'ok' | 'failed'> = {};
            for (const check of deps.checks) {
              try {
                await check.run();
                results[check.name] = 'ok';
              } catch {
                results[check.name] = 'failed';
              }
            }
            const ready = Object.values(results).every((value) => value === 'ok');
            // A failed probe must make orchestrators stop routing traffic: surface it as an error.
            if (!ready) {
              const error = new Error('Not ready') as Error & { statusCode: number };
              error.statusCode = 503;
              throw error;
            }
            return { status: 'ready', checks: results };
          },
        },
        {
          method: 'GET',
          path: '/api/v1/meta',
          auth: 'public',
          handler: () => ({ appName: deps.appName, version: deps.appVersion }),
        },
      ];
    },
  };
}
