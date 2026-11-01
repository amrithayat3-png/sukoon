import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { NotFoundError } from '../../core/errors.js';
import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';

const HomeworkFile = z.object({
  status: z.enum(['draft', 'reviewed']),
  cards: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
        title: z.string().min(3).max(60),
        minutes: z.number().int().min(1).max(60),
        why: z.string().min(10).max(200),
        steps: z.array(z.string().min(5).max(220)).min(2).max(7),
        tip: z.string().max(200).optional(),
      }),
    )
    .min(1),
});
export type HomeworkCard = z.infer<typeof HomeworkFile>['cards'][number];

const CrisisFile = z.object({
  intro: z.string().min(10).max(400),
  emergency: z.string().min(10).max(300),
  /** Local helplines. Supplied by the reviewing psychologist; never invented. */
  entries: z
    .array(z.object({ name: z.string().min(2).max(80), contact: z.string().min(3).max(120), detail: z.string().max(200).optional() }))
    .max(12),
  emptyNote: z.string().min(10).max(300),
});
export type CrisisInfo = z.infer<typeof CrisisFile>;

/** Homework cards and the help page, loaded once from the content folder. */
export class ResourceService {
  private constructor(
    readonly homeworkStatus: 'draft' | 'reviewed',
    private readonly cards: readonly HomeworkCard[],
    readonly crisis: CrisisInfo,
  ) {}

  static async load(contentDir: string): Promise<ResourceService> {
    const read = async (name: string): Promise<unknown> => JSON.parse(await readFile(path.join(contentDir, name), 'utf8'));
    const hw = HomeworkFile.parse(await read('homework.json'));
    const crisis = CrisisFile.parse(await read('crisis.json'));
    const ids = hw.cards.map((c) => c.id);
    if (new Set(ids).size !== ids.length) throw new Error('homework.json has duplicate card ids.');
    return new ResourceService(hw.status, hw.cards, crisis);
  }

  homework(): readonly HomeworkCard[] {
    return this.cards;
  }

  card(id: string): HomeworkCard {
    const found = this.cards.find((c) => c.id === id);
    if (!found) throw new NotFoundError('Unknown homework card.');
    return found;
  }

  has(id: string): boolean {
    return this.cards.some((c) => c.id === id);
  }
}

export function createResourcesPillar(resources: ResourceService): Pillar {
  return {
    name: 'resources',
    routes(): RouteDef[] {
      return [
        {
          method: 'GET',
          path: '/api/v1/homework',
          auth: 'clinician',
          handler: () => ({ status: resources.homeworkStatus, cards: resources.homework() }),
        },
        { method: 'GET', path: '/api/v1/help', auth: 'public', handler: () => resources.crisis },
      ];
    },
  };
}
