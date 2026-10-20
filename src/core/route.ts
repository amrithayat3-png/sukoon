/**
 * Transport-neutral route description. Pillars declare routes as plain data and
 * handlers as plain async functions. A thin adapter (Fastify in production, an
 * in-process dispatcher in tests) turns them into HTTP. This keeps business rules
 * testable without a web server and keeps the framework replaceable.
 */
export interface Principal {
  readonly keyId: string;
  readonly role: 'clinician';
}

export interface RouteContext {
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly body: unknown;
  readonly principal: Principal | null;
  readonly requestId: string;
}

export interface RouteDef {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly auth: 'public' | 'clinician';
  readonly status?: number;
  readonly rateLimit?: { readonly max: number; readonly timeWindow: string };
  handler(context: RouteContext): Promise<unknown> | unknown;
}

export function requirePrincipal(context: RouteContext): Principal {
  if (!context.principal) {
    throw new Error('Route declared as clinician-only was invoked without a principal.');
  }
  return context.principal;
}
