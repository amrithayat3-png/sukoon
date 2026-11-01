import { z } from 'zod';
import type { Pillar } from '../../core/pillar.js';
import type { Principal, RouteDef } from '../../core/route.js';
import { requirePrincipal } from '../../core/route.js';
import type { KvStore } from '../accounts/kv.js';

export interface FeedbackEntry {
  id: number;
  at: string;
  orgId?: string;
  rating: number;
  text: string;
  page: string;
}

const Body = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(1000).default(''),
  page: z.string().trim().max(60).default(''),
});

/** One-tap feedback from psychologists. Never contains patient data; the page name is only a route label. */
export class FeedbackService {
  constructor(
    private readonly kv: KvStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async submit(principal: Principal, input: z.infer<typeof Body>): Promise<{ ok: true }> {
    const id = await this.kv.incr('feedback:count');
    const entry: FeedbackEntry = { id, at: this.clock().toISOString(), rating: input.rating, text: input.text, page: input.page };
    if (principal.orgId) entry.orgId = principal.orgId;
    await this.kv.set(`feedback:item:${id}`, JSON.stringify(entry));
    return { ok: true };
  }

  async recent(limit = 100): Promise<FeedbackEntry[]> {
    const total = Number((await this.kv.get('feedback:count')) ?? 0);
    const ids = Array.from({ length: Math.min(limit, total) }, (_, i) => total - i);
    const raw = await Promise.all(ids.map((id) => this.kv.get(`feedback:item:${id}`)));
    return raw.filter((r): r is string => Boolean(r)).map((r) => JSON.parse(r) as FeedbackEntry);
  }
}

export function createFeedbackPillar(feedback: FeedbackService, withAdmin: boolean): Pillar {
  return {
    name: 'feedback',
    routes(): RouteDef[] {
      const routes: RouteDef[] = [
        {
          method: 'POST',
          path: '/api/v1/feedback',
          auth: 'clinician',
          status: 201,
          rateLimit: { max: 10, timeWindow: '1 minute' },
          handler: (c) => feedback.submit(requirePrincipal(c), Body.parse(c.body)),
        },
      ];
      if (withAdmin) {
        routes.push({ method: 'GET', path: '/api/v1/admin/feedback', auth: 'admin', handler: async () => ({ feedback: await feedback.recent() }) });
      }
      return routes;
    },
  };
}
