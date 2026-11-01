import { z } from 'zod';

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const Id = z.string().regex(ID_PATTERN, 'Use lowercase letters, numbers and hyphens (2 to 64 characters).');

/** Option ids are short labels such as "a", "b", "c". */
const OptionId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, 'Use 1 to 32 lowercase letters, numbers or hyphens.');

export const TRACK_IDS = ['kids', 'teens', 'adults', 'seniors'] as const;
export const TrackIdSchema = z.enum(TRACK_IDS);
export type TrackId = z.infer<typeof TrackIdSchema>;

export const TrackSchema = z.object({
  id: TrackIdSchema,
  label: z.string().min(2).max(40),
  ageRange: z.string().min(2).max(40),
  description: z.string().min(10).max(300),
});
export const TracksFileSchema = z.array(TrackSchema).min(1);
export type Track = z.infer<typeof TrackSchema>;

export const ReferenceSchema = z.object({
  id: Id,
  citation: z.string().min(10).max(600),
  url: z.string().url().optional(),
  /** True only when the source was opened and checked by a person. Unchecked citations are labelled in the UI. */
  verified: z.boolean(),
  note: z.string().max(300).optional(),
});
export const ReferencesFileSchema = z.array(ReferenceSchema);
export type Reference = z.infer<typeof ReferenceSchema>;

const PackBase = z.object({
  id: Id,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use semantic versioning, for example 0.1.0.'),
  track: TrackIdSchema,
  audience: z.array(z.enum(['general', 'men', 'women'])).min(1).default(['general']),
  title: z.string().min(3).max(80),
  summary: z.string().min(10).max(400),
  /** draft: not yet reviewed by a licensed psychologist. reviewed: content sign-off recorded. */
  status: z.enum(['draft', 'reviewed']),
  estimatedMinutes: z.number().int().min(1).max(60),
  references: z.array(Id).min(1),
  clinicianNotes: z.string().max(1500).optional(),
});

const Guidance = z.object({
  ok: z.string().min(10).max(500),
  watch: z.string().min(10).max(500),
  explore: z.string().min(10).max(500),
});

const CheckinPackSchema = PackBase.extend({
  format: z.literal('checkin'),
  prompt: z.string().min(5).max(200),
  scale: z
    .array(z.object({ value: z.number().int().min(0).max(10), label: z.string().min(1).max(40) }))
    .min(2)
    .max(7),
  domains: z
    .array(
      z.object({
        id: Id,
        label: z.string().min(2).max(60),
        description: z.string().min(5).max(200),
        polarity: z.enum(['risk', 'protective']).default('risk'),
        guidance: Guidance,
      }),
    )
    .min(1),
  /** Provisional cut points on a 0 to 100 scale. They are not clinically validated. */
  bands: z
    .object({ watchFrom: z.number().min(0).max(100), exploreFrom: z.number().min(0).max(100) })
    .refine((b) => b.watchFrom < b.exploreFrom, 'watchFrom must be lower than exploreFrom.')
    .default({ watchFrom: 40, exploreFrom: 65 }),
  items: z
    .array(
      z.object({
        id: Id,
        domain: Id,
        text: z.string().min(5).max(220),
        reverse: z.boolean().default(false),
        /** Safety items raise a clinician flag on any answer above the lowest option. */
        safety: z.boolean().default(false),
        /** Unscored items (such as safety items) do not affect the domain score. */
        scored: z.boolean().default(true),
      }),
    )
    .min(3),
});


/**
 * A published questionnaire used with its own answer options and official scoring.
 * Wording is kept as published, so every pack records its licence and where it came from.
 */
const MeasurePackSchema = PackBase.extend({
  format: z.literal('measure'),
  prompt: z.string().min(5).max(240),
  /** Shown above the questions, for example "Think about the past week". */
  timeframe: z.string().min(2).max(60).optional(),
  scale: z
    .array(z.object({ value: z.number().int().min(0).max(10), label: z.string().min(1).max(100) }))
    .min(2)
    .max(7),
  source: z.object({
    licence: z.enum(['free-with-citation', 'open-access-cc-by', 'confirm-before-use']),
    attribution: z.string().min(5).max(400),
    wording: z.enum(['as-published', 'confirm-with-publisher']),
  }),
  subscales: z
    .array(
      z.object({
        id: Id,
        label: z.string().min(2).max(60),
        description: z.string().min(5).max(240),
        polarity: z.enum(['risk', 'protective']).default('risk'),
        /** Final score = sum of item scores times this number (DASS-21 doubles its sums). */
        multiplier: z.number().positive().max(10).default(1),
        /** Published cut points on the final score. Each level starts at "from". */
        cutoffs: z
          .array(
            z.object({
              from: z.number().min(0),
              label: z.string().min(2).max(40),
              band: z.enum(['ok', 'watch', 'explore']),
            }),
          )
          .min(2)
          .optional(),
        /** Reference values reported in the source paper. Shown as "reached or not", never as a label. */
        referenceLines: z.array(z.object({ label: z.string().min(5).max(120), value: z.number() })).max(4).optional(),
        guidance: z.string().min(10).max(500).optional(),
      }),
    )
    .min(1),
  items: z
    .array(
      z.object({
        id: Id,
        subscale: Id,
        text: z.string().min(5).max(240),
        reverse: z.boolean().default(false),
        /** Not an alert. The item is listed for the clinician when the answer is at or above this value. */
        highlightAt: z.number().int().optional(),
      }),
    )
    .min(3),
});

const ScenarioPackSchema = PackBase.extend({
  format: z.literal('scenario'),
  scenarios: z
    .array(
      z.object({
        id: Id,
        skill: z.string().min(2).max(60),
        title: z.string().min(3).max(80),
        setting: z.string().min(3).max(80),
        story: z.string().min(20).max(600),
        options: z
          .array(
            z.object({
              id: OptionId,
              text: z.string().min(5).max(240),
              /** Shown to the patient straight after choosing. Neutral, no rating. */
              outcome: z.string().min(10).max(400),
              points: z.union([z.literal(0), z.literal(1), z.literal(2)]),
              /** Clinician-only rationale. */
              note: z.string().min(10).max(400),
            }),
          )
          .length(3),
        keyMessage: z.string().min(10).max(300),
        discussion: z.string().min(10).max(300),
      }),
    )
    .min(1),
});

export const PackSchema = z.discriminatedUnion('format', [CheckinPackSchema, MeasurePackSchema, ScenarioPackSchema]);
export type Pack = z.output<typeof PackSchema>;
export type CheckinPack = Extract<Pack, { format: 'checkin' }>;
export type MeasurePack = Extract<Pack, { format: 'measure' }>;
export type ScenarioPack = Extract<Pack, { format: 'scenario' }>;

/** Rules a schema cannot express: referential integrity inside and across files. */
export function assertPackIntegrity(pack: Pack, referenceIds: ReadonlySet<string>): void {
  const problems: string[] = [];
  const dupes = (ids: string[]): string[] => ids.filter((id, i) => ids.indexOf(id) !== i);

  for (const ref of pack.references) {
    if (!referenceIds.has(ref)) problems.push(`unknown reference "${ref}"`);
  }

  if (pack.format === 'checkin') {
    const domainIds = pack.domains.map((d) => d.id);
    for (const id of dupes(domainIds)) problems.push(`duplicate domain "${id}"`);
    for (const id of dupes(pack.items.map((i) => i.id))) problems.push(`duplicate item "${id}"`);
    for (const item of pack.items) {
      if (!domainIds.includes(item.domain)) problems.push(`item "${item.id}" uses unknown domain "${item.domain}"`);
    }
    for (const domain of pack.domains) {
      if (!pack.items.some((i) => i.domain === domain.id && i.scored)) {
        problems.push(`domain "${domain.id}" has no scored items`);
      }
    }
    const values = pack.scale.map((s) => s.value);
    for (const id of dupes(values.map(String))) problems.push(`duplicate scale value ${id}`);
  } else if (pack.format === 'measure') {
    const subIds = pack.subscales.map((s) => s.id);
    for (const id of dupes(subIds)) problems.push(`duplicate subscale "${id}"`);
    for (const id of dupes(pack.items.map((i) => i.id))) problems.push(`duplicate item "${id}"`);
    for (const id of dupes(pack.scale.map((x) => String(x.value)))) problems.push(`duplicate scale value ${id}`);
    for (const item of pack.items) {
      if (!subIds.includes(item.subscale)) problems.push(`item "${item.id}" uses unknown subscale "${item.subscale}"`);
    }
    for (const sub of pack.subscales) {
      if (!pack.items.some((i) => i.subscale === sub.id)) problems.push(`subscale "${sub.id}" has no items`);
      const from = (sub.cutoffs ?? []).map((c) => c.from);
      if (from.some((v, i) => i > 0 && v <= (from[i - 1] ?? -1))) problems.push(`subscale "${sub.id}" cutoffs must rise`);
      if (sub.cutoffs && sub.cutoffs[0]?.from !== 0) problems.push(`subscale "${sub.id}" first cutoff must start at 0`);
    }
  } else {
    for (const id of dupes(pack.scenarios.map((s) => s.id))) problems.push(`duplicate scenario "${id}"`);
    for (const scenario of pack.scenarios) {
      for (const id of dupes(scenario.options.map((o) => o.id))) {
        problems.push(`scenario "${scenario.id}" has duplicate option "${id}"`);
      }
      const points = scenario.options.map((o) => o.points).sort((a, b) => a - b);
      if (points.join(',') !== '0,1,2') {
        problems.push(`scenario "${scenario.id}" must have exactly one option each worth 0, 1 and 2 points`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(problems.join('; '));
  }
}
