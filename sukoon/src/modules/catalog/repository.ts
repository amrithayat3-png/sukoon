import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ZodError } from 'zod';
import type { Pack, Reference, Track } from './schema.js';
import { assertPackIntegrity, PackSchema, ReferencesFileSchema, TracksFileSchema } from './schema.js';

/** Port: where content comes from. Today files; tomorrow a database or CMS. */
export interface CatalogRepository {
  tracks(): readonly Track[];
  packs(): readonly Pack[];
  references(): readonly Reference[];
}

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentError';
  }
}

const describe = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');

async function readJson(file: string): Promise<unknown> {
  const text = await readFile(file, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`invalid JSON (${error instanceof Error ? error.message : 'parse error'})`);
  }
}

export class FileCatalogRepository implements CatalogRepository {
  private constructor(
    private readonly trackList: readonly Track[],
    private readonly packList: readonly Pack[],
    private readonly referenceList: readonly Reference[],
  ) {}

  /** Loads and validates every content file. Fails fast with all problems listed together. */
  static async load(contentDir: string): Promise<FileCatalogRepository> {
    const problems: string[] = [];

    let tracks: Track[] = [];
    let references: Reference[] = [];
    try {
      const parsed = TracksFileSchema.safeParse(await readJson(path.join(contentDir, 'tracks.json')));
      if (parsed.success) tracks = parsed.data;
      else problems.push(`tracks.json: ${describe(parsed.error)}`);
    } catch (error) {
      problems.push(`tracks.json: ${error instanceof Error ? error.message : 'unreadable'}`);
    }
    try {
      const parsed = ReferencesFileSchema.safeParse(await readJson(path.join(contentDir, 'references.json')));
      if (parsed.success) references = parsed.data;
      else problems.push(`references.json: ${describe(parsed.error)}`);
    } catch (error) {
      problems.push(`references.json: ${error instanceof Error ? error.message : 'unreadable'}`);
    }

    const referenceIds = new Set(references.map((r) => r.id));
    const trackIds = new Set<string>(tracks.map((t) => t.id));
    const packs: Pack[] = [];
    const seen = new Set<string>();

    let files: string[] = [];
    try {
      files = (await readdir(path.join(contentDir, 'packs'))).filter((f) => f.endsWith('.json')).sort();
    } catch {
      problems.push('packs/: folder is missing or unreadable');
    }

    for (const file of files) {
      try {
        const parsed = PackSchema.safeParse(await readJson(path.join(contentDir, 'packs', file)));
        if (!parsed.success) {
          problems.push(`packs/${file}: ${describe(parsed.error)}`);
          continue;
        }
        const pack = parsed.data;
        if (file !== `${pack.id}.json`) problems.push(`packs/${file}: file name must be "${pack.id}.json"`);
        if (seen.has(pack.id)) problems.push(`packs/${file}: duplicate pack id "${pack.id}"`);
        if (!trackIds.has(pack.track)) problems.push(`packs/${file}: track "${pack.track}" is not defined in tracks.json`);
        assertPackIntegrity(pack, referenceIds);
        seen.add(pack.id);
        packs.push(pack);
      } catch (error) {
        problems.push(`packs/${file}: ${error instanceof Error ? error.message : 'unreadable'}`);
      }
    }

    if (problems.length > 0) {
      throw new ContentError(`Content validation failed:\n- ${problems.join('\n- ')}`);
    }
    return new FileCatalogRepository(tracks, packs, references);
  }

  tracks(): readonly Track[] {
    return this.trackList;
  }
  packs(): readonly Pack[] {
    return this.packList;
  }
  references(): readonly Reference[] {
    return this.referenceList;
  }
}
