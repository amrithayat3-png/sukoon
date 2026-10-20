import { ValidationError } from '../../core/errors.js';
import type { Pack } from '../catalog/schema.js';
import type { Band, DomainResult, Flag, ResultSummary, Responses, ScoringStrategy } from './types.js';
import { DISCLAIMER } from './types.js';

function asCheckin(pack: Pack): Extract<Pack, { format: 'checkin' }> {
  if (pack.format !== 'checkin') throw new Error(`Check-in scoring received a ${pack.format} pack.`);
  return pack;
}

export class CheckinScoring implements ScoringStrategy {
  readonly format = 'checkin' as const;

  expectedAnswers(pack: Pack): number {
    return asCheckin(pack).items.length;
  }

  validate(pack: Pack, responses: Responses, complete: boolean): void {
    const p = asCheckin(pack);
    const itemIds = new Set(p.items.map((item) => item.id));
    const allowed = new Set(p.scale.map((option) => option.value));

    for (const [key, value] of Object.entries(responses)) {
      if (!itemIds.has(key)) throw new ValidationError(`Unknown item "${key}".`);
      if (typeof value !== 'number' || !allowed.has(value)) {
        throw new ValidationError(`Invalid answer for "${key}".`);
      }
    }
    if (complete) {
      const missing = p.items.filter((item) => !(item.id in responses));
      if (missing.length > 0) {
        throw new ValidationError(`${missing.length} question(s) are still unanswered.`);
      }
    }
  }

  score(pack: Pack, responses: Responses): ResultSummary {
    const p = asCheckin(pack);
    const values = p.scale.map((option) => option.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;

    const domains: DomainResult[] = p.domains.map((domain) => {
      const scored = p.items.filter((item) => item.domain === domain.id && item.scored);
      const normalised = scored.map((item) => {
        const raw = Number(responses[item.id]);
        const adjusted = item.reverse ? max - (raw - min) : raw;
        return (adjusted - min) / span;
      });
      const mean = normalised.reduce((sum, v) => sum + v, 0) / normalised.length;
      const score = Math.round(mean * 100);
      // Protective domains are judged on how little strength there is, so invert before banding.
      const concern = domain.polarity === 'risk' ? score : 100 - score;
      const band: Band =
        concern >= p.bands.exploreFrom ? 'explore' : concern >= p.bands.watchFrom ? 'watch' : 'ok';
      return {
        id: domain.id,
        label: domain.label,
        polarity: domain.polarity,
        score,
        band,
        guidance: domain.guidance[band],
      };
    });

    const flags: Flag[] = p.items
      .filter((item) => item.safety && Number(responses[item.id]) > min)
      .map((item) => ({
        kind: 'safety' as const,
        itemId: item.id,
        message:
          'The person marked a safety-related statement. Follow your clinical safety protocol before continuing.',
      }));

    return {
      packId: p.id,
      packVersion: p.version,
      format: 'checkin',
      status: p.status,
      provisional: true,
      domains,
      flags,
      disclaimer: DISCLAIMER,
    };
  }
}
