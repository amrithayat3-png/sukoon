import type { FastifyInstance } from 'fastify';
import type { Principal, RouteDef } from '../core/route.js';

/**
 * The only place routes become Fastify routes. Authentication, error mapping and
 * rate-limit overrides are applied uniformly here so pillars cannot forget them.
 */
export function registerRoutes(
  app: FastifyInstance,
  routes: readonly RouteDef[],
  authenticate: (header: string | undefined) => Principal,
): void {
  for (const route of routes) {
    app.route({
      method: route.method,
      url: route.path,
      config: route.rateLimit ? { rateLimit: route.rateLimit } : {},
      handler: async (request, reply) => {
        const principal = route.auth === 'clinician' ? authenticate(request.headers.authorization) : null;
        const result = await route.handler({
          params: (request.params ?? {}) as Record<string, string>,
          query: (request.query ?? {}) as Record<string, unknown>,
          body: request.body,
          principal,
          requestId: request.id,
        });
        reply.code(route.status ?? 200);
        return reply.send(result);
      },
    });
  }
}
