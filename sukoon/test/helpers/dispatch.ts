import type { Platform } from '../../src/composition.js';
import { toErrorResponse } from '../../src/core/http.js';

export interface DispatchRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface DispatchResponse {
  status: number;
  body: unknown;
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i += 1) {
    const want = expected[i] ?? '';
    const got = actual[i] ?? '';
    if (want.startsWith(':')) params[want.slice(1)] = decodeURIComponent(got);
    else if (want !== got) return null;
  }
  return params;
}

/**
 * In-process stand-in for the web adapter. It applies the same rules as
 * http/fastify-adapter.ts (authentication, status codes, error mapping), so the
 * whole application layer can be exercised without a network or a framework.
 */
export async function dispatch(
  platform: Pick<Platform, 'routes' | 'authenticate'>,
  request: DispatchRequest,
): Promise<DispatchResponse> {
  const [pathname = '', search = ''] = request.url.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));

  for (const route of platform.routes) {
    if (route.method !== request.method) continue;
    const params = matchPath(route.path, pathname);
    if (!params) continue;
    try {
      const principal =
        route.auth === 'clinician' ? platform.authenticate(request.headers?.['authorization']) : null;
      const result = await route.handler({
        params,
        query,
        body: request.body,
        principal,
        requestId: 'test-request',
      });
      return { status: route.status ?? 200, body: result };
    } catch (error) {
      const response = toErrorResponse(error);
      return { status: response.status, body: response.body };
    }
  }
  return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.' } } };
}
