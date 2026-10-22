import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Session, SessionRepository } from './types.js';

/**
 * Decorator that seals the sensitive parts of a session (answers and alias) with
 * AES-256-GCM before they reach the real store. Anyone who can read the database
 * but not SESSION_ENCRYPTION_KEY sees only ids, pack names and timestamps.
 */
export class EncryptedSessionRepository implements SessionRepository {
  private readonly key: Buffer;

  constructor(
    private readonly inner: SessionRepository,
    secret: string,
  ) {
    this.key = createHash('sha256').update(secret).digest();
    if (inner.increment) this.increment = (key, windowSeconds) => inner.increment!(key, windowSeconds);
  }

  private seal(session: Session): Session {
    const { responses, alias, ...rest } = session;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify({ responses, alias }), 'utf8'), cipher.final()]);
    const sealed = Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
    return { ...rest, responses: {}, sealed };
  }

  private open(session: Session): Session {
    if (!session.sealed) return session;
    const raw = Buffer.from(session.sealed, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    const { responses, alias } = JSON.parse(text) as Pick<Session, 'responses' | 'alias'>;
    const { sealed: _sealed, ...rest } = session;
    const opened: Session = { ...rest, responses };
    if (alias) opened.alias = alias;
    return opened;
  }

  create(session: Session): Promise<void> {
    return this.inner.create(this.seal(session));
  }
  async get(id: string): Promise<Session | undefined> {
    const found = await this.inner.get(id);
    return found ? this.open(found) : undefined;
  }
  save(session: Session): Promise<void> {
    return this.inner.save(this.seal(session));
  }
  delete(id: string): Promise<boolean> {
    return this.inner.delete(id);
  }
  deleteExpired(nowIso: string): Promise<string[]> {
    return this.inner.deleteExpired(nowIso);
  }
  count(): Promise<number> {
    return this.inner.count();
  }
  ping(): Promise<void> {
    return this.inner.ping ? this.inner.ping() : this.inner.count().then(() => undefined);
  }
  increment?: (key: string, windowSeconds: number) => Promise<number>;
  async close(): Promise<void> {
    await this.inner.close?.();
  }
}
