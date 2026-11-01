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
  /** Published questionnaires only: the official score before conversion to 0 to 100. */
  raw?: number;
  rawMin?: number;
  rawMax?: number;
  /** Published level label, for example "Moderate". */
  level?: string;
  /** False when the questionnaire publishes no cut points, so the bar carries no colour meaning. */
  banded?: boolean;
  /** Reference values from the source paper, with whether the score reached each one. */
  referenceLines?: Array<{ label: string; value: number; reached: boolean }>;
}

export interface Highlight {
  itemId: string;
  text: string;
  answer: number;
  answerLabel: string;
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
  /** True for our own activities. Published questionnaires use their published scoring, so false. */
  provisional: boolean;
  domains: DomainResult[];
  flags: Flag[];
  /** Items the clinician may want to look at together. Not alerts. */
  highlights?: Highlight[];
  disclaimer: string;
}

export const DISCLAIMER =
  'Provisional summary to support the judgement of a licensed professional. It is not a diagnosis and has not been clinically validated.';

export const MEASURE_DISCLAIMER =
  'Scores follow the published scoring of the source questionnaire. They are screening information to support a licensed professional, not a diagnosis, and no local norms are available yet. Treat them as hypotheses to check in conversation.';

/** A scoring strategy owns the rules for one activity format. Add a format by registering a strategy. */
export interface ScoringStrategy {
  readonly format: Pack['format'];
  /** Throws ValidationError for unknown keys or invalid values. With `complete`, also for missing answers. */
  validate(pack: Pack, responses: Responses, complete: boolean): void;
  score(pack: Pack, responses: Responses): ResultSummary;
  /** How many answers make the activity complete. */
  expectedAnswers(pack: Pack): number;
}
