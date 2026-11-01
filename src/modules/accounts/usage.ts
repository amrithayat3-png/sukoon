import type { Principal } from '../../core/route.js';
import type { KvStore } from './kv.js';

export interface UsageDay {
  date: string;
  created: number;
  completed: number;
}

export interface UsageReport {
  days: UsageDay[];
  totals: { created: number; completed: number };
  packs: Array<{ packId: string; created: number }>;
}

const DAYS = 30;
const KEEP_SECONDS = 100 * 86_400;

/** Counts sessions per institute per day. Only numbers are kept: no answers, no names, no aliases. */
export class UsageMeter {
  constructor(
    private readonly kv: KvStore,
    private readonly clock: () => Date,
    private readonly packIds: readonly string[],
  ) {}

  private day(offset = 0): string {
    return new Date(this.clock().getTime() - offset * 86_400_000).toISOString().slice(0, 10);
  }

  async created(principal: Principal, packId: string): Promise<void> {
    if (!principal.orgId) return;
    await this.kv.incr(`usage-day:${principal.orgId}:${this.day()}:c`, KEEP_SECONDS);
    await this.kv.incr(`usage-pack:${principal.orgId}:${this.day().slice(0, 7)}:${packId}`, 40 * 86_400);
  }

  async completed(principal: Principal, _packId: string): Promise<void> {
    if (!principal.orgId) return;
    await this.kv.incr(`usage-day:${principal.orgId}:${this.day()}:d`, KEEP_SECONDS);
  }

  private async count(key: string): Promise<number> {
    return Number((await this.kv.get(key)) ?? 0);
  }

  async report(orgId: string, withPacks = true): Promise<UsageReport> {
    const dates = Array.from({ length: DAYS }, (_, i) => this.day(DAYS - 1 - i));
    const days = await Promise.all(
      dates.map(async (date) => ({
        date,
        created: await this.count(`usage-day:${orgId}:${date}:c`),
        completed: await this.count(`usage-day:${orgId}:${date}:d`),
      })),
    );
    const packs = withPacks
      ? (
          await Promise.all(
            this.packIds.map(async (packId) => ({ packId, created: await this.count(`usage-pack:${orgId}:${this.day().slice(0, 7)}:${packId}`) })),
          )
        )
          .filter((p) => p.created > 0)
          .sort((a, b) => b.created - a.created)
          .slice(0, 8)
      : [];
    return {
      days,
      totals: { created: days.reduce((n, d) => n + d.created, 0), completed: days.reduce((n, d) => n + d.completed, 0) },
      packs,
    };
  }
}
