import path from 'node:path';
import { FileCatalogRepository } from '../src/modules/catalog/repository.js';

const dir = path.resolve(process.cwd(), process.argv[2] ?? 'content');

try {
  const catalog = await FileCatalogRepository.load(dir);
  const packs = catalog.packs();
  console.log(`Content OK: ${catalog.tracks().length} tracks, ${packs.length} packs, ${catalog.references().length} references.`);
  for (const pack of packs) {
    console.log(`  - ${pack.id} v${pack.version} [${pack.format}, ${pack.status}]`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
