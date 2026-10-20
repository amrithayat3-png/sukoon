import type { Session, SessionRepository } from './types.js';

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface RedisRestOptions {
  url: string;
  token: string;
  prefix?: string;
  clock?: () => Date;
  fetcher?: Fetcher;
}

/**
 * Session store backed by a Redis REST endpoint (Upstash, as offered through the Vercel
 * Marketplace). It uses plain fetch, so it adds no dependency and works on serverless,
 * where in-memory state does not survive between requests.
 *
 * Every key carries a TTL equal to the session expiry, so Redis erases sessions on its
 * own even if no sweeper runs. Answers are sensitive: keep SESSION_TTL_HOURS short.
 */
export class RedisRestSessionRepository implements SessionRepository {
  private readonly prefix: string;
  private readonly clock: () => Date;
  private readonly fetcher: Fetcher;

  constructor(private readonly options: RedisRestOptions) {
    this.prefix = options.prefix ?? 'sukoon:session:';
    this.clock = options.clock ?? (() => new Date());
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  }

  private async command<T>(...args: Array<string | number>): Promise<T> {
    const res = await this.fetcher(this.options.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.options.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => null)) as { result?: T; error?: string } | null;
    if (!res.ok || !data || data.error) {
      throw new Error(`Session store error (${res.status})${data?.error ? `: ${data.error}` : ''}`);
    }
    return data.result as T;
  }

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  private ttlMs(session: Session): number {
    return Math.max(1000, new Date(session.expiresAt).getTime() - this.clock().getTime());
  }

  async create(session: Session): Promise<void> {
    await this.command('SET', this.key(session.id), JSON.stringify(session), 'PX', this.ttlMs(session));
  }

  async get(id: string): Promise<Session | undefined> {
    const raw = await this.command<string | null>('GET', this.key(id));
    return raw ? (JSON.parse(raw) as Session) : undefined;
  }

  async save(session: Session): Promise<void> {
    await this.create(session);
  }

  async delete(id: string): Promise<boolean> {
    return (await this.command<number>('DEL', this.key(id))) > 0;
  }

  /** Redis expires keys itself, so there is nothing to sweep. */
  async deleteExpired(): Promise<string[]> {
    return [];
  }

  async count(): Promise<number> {
    let cursor = '0';
    let total = 0;
    do {
      const [next, keys] = await this.command<[string, string[]]>('SCAN', cursor, 'MATCH', `${this.prefix}*`, 'COUNT', 200);
      cursor = next;
      total += keys.length;
    } while (cursor !== '0');
    return total;
  }

  /** Readiness probe: throws if the store is unreachable or the token is wrong. */
  async ping(): Promise<void> {
    await this.command('PING');
  }
}
