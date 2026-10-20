import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MemorySessionRepository } from './memory-repository.js';
import type { Session } from './types.js';

/**
 * Persists sessions to a single JSON file with atomic replace. Suitable for a single
 * instance and small volumes. Session answers are sensitive: keep SESSION_TTL_HOURS
 * short and protect the volume. For multi-instance deployments use a database adapter.
 */
export class FileSessionRepository extends MemorySessionRepository {
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(private readonly filePath: string) {
    super();
  }

  static async open(filePath: string): Promise<FileSessionRepository> {
    const repo = new FileSessionRepository(filePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as Session[];
      for (const session of parsed) repo.items.set(session.id, session);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
    return repo;
  }

  private flush(): Promise<void> {
    const snapshot = JSON.stringify([...this.items.values()]);
    this.writeChain = this.writeChain.then(async () => {
      const temp = `${this.filePath}.tmp`;
      await writeFile(temp, snapshot, { encoding: 'utf8', mode: 0o600 });
      await rename(temp, this.filePath);
    });
    return this.writeChain;
  }

  override async create(session: Session): Promise<void> {
    await super.create(session);
    await this.flush();
  }

  override async save(session: Session): Promise<void> {
    await super.save(session);
    await this.flush();
  }

  override async delete(id: string): Promise<boolean> {
    const removed = await super.delete(id);
    if (removed) await this.flush();
    return removed;
  }

  override async deleteExpired(nowIso: string): Promise<string[]> {
    const removed = await super.deleteExpired(nowIso);
    if (removed.length > 0) await this.flush();
    return removed;
  }

  async close(): Promise<void> {
    await this.writeChain;
  }
}
