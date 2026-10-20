import type { Pack } from '../catalog/schema.js';
import type { ResultSummary, Responses, ScoringStrategy } from './types.js';

/** Dispatches to the strategy registered for a pack's format. */
export class ScoringEngine {
  private readonly strategies = new Map<string, ScoringStrategy>();

  register(strategy: ScoringStrategy): this {
    if (this.strategies.has(strategy.format)) {
      throw new Error(`A scoring strategy for "${strategy.format}" is already registered.`);
    }
    this.strategies.set(strategy.format, strategy);
    return this;
  }

  private strategyFor(pack: Pack): ScoringStrategy {
    const strategy = this.strategies.get(pack.format);
    if (!strategy) throw new Error(`No scoring strategy registered for format "${pack.format}".`);
    return strategy;
  }

  validate(pack: Pack, responses: Responses, complete: boolean): void {
    this.strategyFor(pack).validate(pack, responses, complete);
  }

  score(pack: Pack, responses: Responses): ResultSummary {
    return this.strategyFor(pack).score(pack, responses);
  }

  expectedAnswers(pack: Pack): number {
    return this.strategyFor(pack).expectedAnswers(pack);
  }
}
