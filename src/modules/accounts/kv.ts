/** Small key-value port for durable account data (no expiry). Memory and Redis REST adapters ship. */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic increment. When `ttlSeconds` is given it applies on first creation. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
}

export class MemoryKv implements KvStore {
  private readonly items = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.items.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.items.set(key, value);
  }
  async del(key: string): Promise<void> {
    this.items.delete(key);
  }
  async incr(key: string): Promise<number> {
    const next = Number(this.items.get(key) ?? 0) + 1;
    this.items.set(key, String(next));
    return next;
  }
}

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class RedisKv implements KvStore {
  private readonly fetcher: Fetcher;
  constructor(private readonly options: { url: string; token: string; prefix?: string; fetcher?: Fetcher }) {
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  }
  private k(key: string): string {
    return `${this.options.prefix ?? 'sukoon:acct:'}${key}`;
  }
  private async command<T>(...args: Array<string | number>): Promise<T> {
    const res = await this.fetcher(this.options.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.options.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => null)) as { result?: T; error?: string } | null;
    if (!res.ok || !data || data.error) throw new Error(`Account store error (${res.status})${data?.error ? `: ${data.error}` : ''}`);
    return data.result as T;
  }
  get(key: string): Promise<string | null> {
    return this.command<string | null>('GET', this.k(key));
  }
  async set(key: string, value: string): Promise<void> {
    await this.command('SET', this.k(key), value);
  }
  async del(key: string): Promise<void> {
    await this.command('DEL', this.k(key));
  }
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const n = await this.command<number>('INCR', this.k(key));
    if (n === 1 && ttlSeconds) await this.command('EXPIRE', this.k(key), ttlSeconds);
    return n;
  }
}
