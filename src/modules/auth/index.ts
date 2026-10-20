import { createHash, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from '../../core/errors.js';
import type { Pillar } from '../../core/pillar.js';
import type { Principal, RouteDef } from '../../core/route.js';
import { requirePrincipal } from '../../core/route.js';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Holds clinician access keys as SHA-256 digests and compares them in constant time.
 * This is deliberately simple for pilots. The seam for per-clinician accounts, SSO or
 * an identity provider is `authenticate`: replace the implementation, keep the contract.
 */
export class KeyRing {
  private readonly entries: ReadonlyArray<{ digest: Buffer; keyId: string }>;

  constructor(keys: readonly string[]) {
    this.entries = keys.map((key) => {
      const d = digest(key);
      return { digest: d, keyId: d.toString('hex').slice(0, 8) };
    });
  }

  verify(candidate: string | undefined): Principal | null {
    if (!candidate) return null;
    const candidateDigest = digest(candidate);
    let match: Principal | null = null;
    for (const entry of this.entries) {
      // No early exit, so timing does not reveal which entry matched.
      if (timingSafeEqual(candidateDigest, entry.digest)) {
        match = { keyId: entry.keyId, role: 'clinician' };
      }
    }
    return match;
  }

  /** Parses an `Authorization: Bearer <key>` header. Throws UnauthorizedError when invalid. */
  authenticate(header: string | undefined): Principal {
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    const principal = this.verify(token);
    if (!principal) throw new UnauthorizedError();
    return principal;
  }
}

export function createAuthPillar(): Pillar {
  return {
    name: 'auth',
    routes(): RouteDef[] {
      return [
        {
          method: 'POST',
          path: '/api/v1/auth/verify',
          auth: 'clinician',
          // Tighter than the global limit so keys cannot be guessed quickly.
          rateLimit: { max: 20, timeWindow: '1 minute' },
          handler: (context) => {
            const principal = requirePrincipal(context);
            return { ok: true, keyId: principal.keyId, role: principal.role };
          },
        },
      ];
    },
  };
}
