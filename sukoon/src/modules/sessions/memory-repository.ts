import type { Session, SessionRepository } from './types.js';

export class MemorySessionRepository implements SessionRepository {
  protected readonly items = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.items.set(session.id, structuredClone(session));
  }

  async get(id: string): Promise<Session | undefined> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : undefined;
  }

  async save(session: Session): Promise<void> {
    this.items.set(session.id, structuredClone(session));
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async deleteExpired(nowIso: string): Promise<string[]> {
    const removed: string[] = [];
    for (const [id, session] of this.items) {
      if (session.expiresAt <= nowIso) {
        this.items.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  async count(): Promise<number> {
    return this.items.size;
  }
}
