import type { Responses } from '../scoring/types.js';

export interface Session {
  id: string;
  /** Short human-readable code the clinician can quote. Not a credential. */
  code: string;
  packId: string;
  packVersion: string;
  /** Which clinician key owns the session. Other keys cannot see it. */
  keyId: string;
  /** Optional clinician-entered label. The UI asks for initials or a nickname, never a full name. */
  alias?: string;
  status: 'active' | 'completed';
  responses: Responses;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expiresAt: string;
}

export interface SessionView {
  id: string;
  code: string;
  packId: string;
  status: Session['status'];
  expiresAt: string;
  answered: number;
  total: number;
}

/** Port: where sessions live. Memory and file adapters ship; a Postgres adapter plugs in here. */
export interface SessionRepository {
  create(session: Session): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<boolean>;
  /** Removes sessions that expired at or before `nowIso`. Returns the removed ids. */
  deleteExpired(nowIso: string): Promise<string[]>;
  count(): Promise<number>;
  close?(): Promise<void>;
}
