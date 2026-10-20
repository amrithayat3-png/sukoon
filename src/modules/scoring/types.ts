import type { Pack } from '../catalog/schema.js';

/** Item id mapped to a scale value (check-ins) or a scenario id mapped to an option id (scenarios). */
export type Responses = Record<string, number | string>;

export type Band = 'ok' | 'watch' | 'explore';

export interface DomainResult {
  id: string;
  label: string;
  polarity: 'risk' | 'protective' | 'skill';
  /** 0 to 100. For risk domains higher means more to explore. For protective and skill domains higher is stronger. */
  score: number;
  band: Band;
  guidance: string;
}

export interface Flag {
  kind: 'safety';
  itemId: string;
  message: string;
}

export interface ResultSummary {
  packId: string;
  packVersion: string;
  format: Pack['format'];
  status: Pack['status'];
  /** Always true until a validation study is recorded for the pack. */
  provisional: true;
  domains: DomainResult[];
  flags: Flag[];
  disclaimer: string;
}

export const DISCLAIMER =
  'Provisional summary to support the judgement of a licensed professional. It is not a diagnosis and has not been clinically validated.';

/** A scoring strategy owns the rules for one activity format. Add a format by registering a strategy. */
export interface ScoringStrategy {
  readonly format: Pack['format'];
  /** Throws ValidationError for unknown keys or invalid values. With `complete`, also for missing answers. */
  validate(pack: Pack, responses: Responses, complete: boolean): void;
  score(pack: Pack, responses: Responses): ResultSummary;
  /** How many answers make the activity complete. */
  expectedAnswers(pack: Pack): number;
}
