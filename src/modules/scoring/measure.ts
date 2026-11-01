import { ValidationError } from '../../core/errors.js';
import type { Pack } from '../catalog/schema.js';
import type { DomainResult, Highlight, ResultSummary, Responses, ScoringStrategy } from './types.js';
import { MEASURE_DISCLAIMER } from './types.js';

function asMeasure(pack: Pack): Extract<Pack, { format: 'measure' }> {
  if (pack.format !== 'measure') throw new Error(`Measure scoring received a ${pack.format} pack.`);
  return pack;
}

/** Published questionnaires: sum per subscale, optional reverse items, optional multiplier and published cut points. */
export class MeasureScoring implements ScoringStrategy {
  readonly format = 'measure' as const;

  expectedAnswers(pack: Pack): number {
    return asMeasure(pack).items.length;
  }

  validate(pack: Pack, responses: Responses, complete: boolean): void {
    const p = asMeasure(pack);
    const itemIds = new Set(p.items.map((item) => item.id));
    const allowed = new Set(p.scale.map((option) => option.value));
    for (const [key, value] of Object.entries(responses)) {
      if (!itemIds.has(key)) throw new ValidationError(`Unknown item "${key}".`);
      if (typeof value !== 'number' || !allowed.has(value)) throw new ValidationError(`Invalid answer for "${key}".`);
    }
    if (complete) {
      const missing = p.items.filter((item) => !(item.id in responses));
      if (missing.length > 0) throw new ValidationError(`${missing.length} question(s) are still unanswered.`);
    }
  }

  score(pack: Pack, responses: Responses): ResultSummary {
    const p = asMeasure(pack);
    const values = p.scale.map((option) => option.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const domains: DomainResult[] = p.subscales.map((sub) => {
      const items = p.items.filter((item) => item.subscale === sub.id);
      const sum = items.reduce((total, item) => {
        const raw = Number(responses[item.id]);
        return total + (item.reverse ? max + min - raw : raw);
      }, 0);
      const final = round(sum * sub.multiplier);
      const finalMin = round(items.length * min * sub.multiplier);
      const finalMax = round(items.length * max * sub.multiplier);
      const span = finalMax - finalMin;
      const score = span > 0 ? Math.round(((final - finalMin) / span) * 100) : 0;
      const level = sub.cutoffs ? [...sub.cutoffs].reverse().find((c) => final >= c.from) : undefined;
      const band = level?.band ?? 'ok';
      const guidance =
        sub.guidance ??
        `${sub.label}: ${final} out of ${finalMax}${level ? ` (${level.label})` : ''}. ${
          sub.polarity === 'risk' ? 'Higher scores mean more of this was reported.' : 'Higher scores mean a stronger result.'
        } Use it as a starting point for your own questions.`;
      const result: DomainResult = {
        id: sub.id,
        label: sub.label,
        polarity: sub.polarity,
        score,
        band,
        guidance,
        raw: final,
        rawMin: finalMin,
        rawMax: finalMax,
        banded: Boolean(sub.cutoffs),
      };
      if (level) result.level = level.label;
      if (sub.referenceLines?.length) {
        result.referenceLines = sub.referenceLines.map((line) => ({ label: line.label, value: line.value, reached: final >= line.value }));
      }
      return result;
    });

    const highlights: Highlight[] = p.items
      .filter((item) => item.highlightAt !== undefined && Number(responses[item.id]) >= (item.highlightAt as number))
      .map((item) => ({
        itemId: item.id,
        text: item.text,
        answer: Number(responses[item.id]),
        answerLabel: p.scale.find((option) => option.value === Number(responses[item.id]))?.label ?? '',
      }));

    return {
      packId: p.id,
      packVersion: p.version,
      format: 'measure',
      status: p.status,
      provisional: false,
      domains,
      flags: [],
      highlights,
      disclaimer: MEASURE_DISCLAIMER,
    };
  }
}

const round = (n: number): number => Math.round(n * 100) / 100;
