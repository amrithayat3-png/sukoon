import { ValidationError } from '../../core/errors.js';
import type { Pack } from '../catalog/schema.js';
import type { Band, DomainResult, ResultSummary, Responses, ScoringStrategy } from './types.js';
import { DISCLAIMER } from './types.js';

function asScenario(pack: Pack): Extract<Pack, { format: 'scenario' }> {
  if (pack.format !== 'scenario') throw new Error(`Scenario scoring received a ${pack.format} pack.`);
  return pack;
}

const SCORE_BY_POINTS: Record<0 | 1 | 2, number> = { 2: 100, 1: 55, 0: 20 };
const BAND_BY_POINTS: Record<0 | 1 | 2, Band> = { 2: 'ok', 1: 'watch', 0: 'explore' };

export class ScenarioScoring implements ScoringStrategy {
  readonly format = 'scenario' as const;

  expectedAnswers(pack: Pack): number {
    return asScenario(pack).scenarios.length;
  }

  validate(pack: Pack, responses: Responses, complete: boolean): void {
    const p = asScenario(pack);
    for (const [key, value] of Object.entries(responses)) {
      const scenario = p.scenarios.find((s) => s.id === key);
      if (!scenario) throw new ValidationError(`Unknown scenario "${key}".`);
      if (typeof value !== 'string' || !scenario.options.some((o) => o.id === value)) {
        throw new ValidationError(`Invalid choice for "${key}".`);
      }
    }
    if (complete) {
      const missing = p.scenarios.filter((s) => !(s.id in responses));
      if (missing.length > 0) {
        throw new ValidationError(`${missing.length} scenario(s) are still unanswered.`);
      }
    }
  }

  score(pack: Pack, responses: Responses): ResultSummary {
    const p = asScenario(pack);
    const domains: DomainResult[] = p.scenarios.map((scenario) => {
      const chosen = scenario.options.find((o) => o.id === responses[scenario.id]);
      if (!chosen) throw new ValidationError(`Scenario "${scenario.id}" has no valid choice.`);
      return {
        id: scenario.id,
        label: scenario.skill,
        polarity: 'skill',
        score: SCORE_BY_POINTS[chosen.points],
        band: BAND_BY_POINTS[chosen.points],
        guidance: `${chosen.note} Key message: ${scenario.keyMessage} To discuss: ${scenario.discussion}`,
      };
    });
    return {
      packId: p.id,
      packVersion: p.version,
      format: 'scenario',
      status: p.status,
      provisional: true,
      domains,
      flags: [],
      disclaimer: DISCLAIMER,
    };
  }
}
