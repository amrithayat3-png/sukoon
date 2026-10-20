import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ContentError, FileCatalogRepository } from '../src/modules/catalog/repository.js';
import { CatalogService } from '../src/modules/catalog/service.js';
import { collectKeys } from './helpers/platform.js';

const CONTENT = path.resolve(process.cwd(), 'content');

const SECRET_KEYS = [
  'points',
  'note',
  'guidance',
  'bands',
  'domains',
  'domain',
  'safety',
  'scored',
  'reverse',
  'clinicianNotes',
  'keyMessage',
  'discussion',
  'polarity',
];

async function withTempContent(mutate: (dir: string) => Promise<void>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sukoon-content-'));
  await cp(CONTENT, dir, { recursive: true });
  try {
    await mutate(dir);
    await FileCatalogRepository.load(dir);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('catalog content', () => {
  it('loads every shipped pack and resolves references', async () => {
    const repo = await FileCatalogRepository.load(CONTENT);
    const catalog = new CatalogService(repo);
    assert.ok(catalog.packCount() >= 2);
    const tracks = catalog.listTracks();
    assert.deepEqual(
      tracks.map((t) => t.id),
      ['kids', 'teens', 'adults', 'seniors'],
    );
    const detail = catalog.getPackDetail('adults-stress-wellbeing');
    assert.ok(detail.references.length >= 1);
  });

  it('never exposes scoring rules or clinician material in the patient view', async () => {
    const catalog = new CatalogService(await FileCatalogRepository.load(CONTENT));
    for (const id of ['adults-stress-wellbeing', 'teens-pressure-and-peers']) {
      const keys = collectKeys(catalog.getPackDetail(id).patientView);
      for (const secret of SECRET_KEYS) {
        assert.equal(keys.has(secret), false, `${id} patient view leaks "${secret}"`);
      }
    }
  });

  it('reports a clear error for an item that points to an unknown domain', async () => {
    const message = await withTempContent(async (dir) => {
      const file = path.join(dir, 'packs', 'adults-stress-wellbeing.json');
      const pack = JSON.parse(await readFile(file, 'utf8')) as { items: Array<{ domain: string }> };
      const first = pack.items[0];
      if (first) first.domain = 'does-not-exist';
      await writeFile(file, JSON.stringify(pack));
    });
    assert.match(message, /unknown domain "does-not-exist"/);
  });

  it('reports unknown references, bad JSON and mismatched file names together', async () => {
    const message = await withTempContent(async (dir) => {
      const file = path.join(dir, 'packs', 'teens-pressure-and-peers.json');
      const pack = JSON.parse(await readFile(file, 'utf8')) as { references: string[] };
      pack.references = ['no-such-reference'];
      await writeFile(file, JSON.stringify(pack));
      await writeFile(path.join(dir, 'packs', 'broken.json'), '{ not json');
    });
    assert.match(message, /unknown reference "no-such-reference"/);
    assert.match(message, /broken\.json: invalid JSON/);
  });

  it('rejects a scenario whose options do not cover 0, 1 and 2 points', async () => {
    const message = await withTempContent(async (dir) => {
      const file = path.join(dir, 'packs', 'teens-pressure-and-peers.json');
      const pack = JSON.parse(await readFile(file, 'utf8')) as {
        scenarios: Array<{ options: Array<{ points: number }> }>;
      };
      const option = pack.scenarios[0]?.options[2];
      if (option) option.points = 2;
      await writeFile(file, JSON.stringify(pack));
    });
    assert.match(message, /exactly one option each worth 0, 1 and 2 points/);
  });

  it('throws ContentError type for invalid content', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'sukoon-empty-'));
    try {
      await assert.rejects(FileCatalogRepository.load(dir), ContentError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
