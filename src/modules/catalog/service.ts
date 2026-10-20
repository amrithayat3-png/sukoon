import { NotFoundError } from '../../core/errors.js';
import type { CatalogRepository } from './repository.js';
import type { Pack, Reference, Track } from './schema.js';
import type { PackSummary, PatientPackView } from './views.js';
import { toPatientView, toSummary } from './views.js';

export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  listTracks(): Array<Track & { packCount: number }> {
    return this.repo.tracks().map((track) => ({
      ...track,
      packCount: this.repo.packs().filter((pack) => pack.track === track.id).length,
    }));
  }

  listPacks(trackId: string): PackSummary[] {
    if (!this.repo.tracks().some((track) => track.id === trackId)) {
      throw new NotFoundError('Unknown track.');
    }
    return this.repo
      .packs()
      .filter((pack) => pack.track === trackId)
      .map(toSummary);
  }

  /** Full pack including scoring rules. For server-side use only. */
  getPack(packId: string): Pack {
    const pack = this.repo.packs().find((p) => p.id === packId);
    if (!pack) throw new NotFoundError('Unknown activity pack.');
    return pack;
  }

  getPackDetail(packId: string): { summary: PackSummary; patientView: PatientPackView; references: Reference[] } {
    const pack = this.getPack(packId);
    return {
      summary: toSummary(pack),
      patientView: toPatientView(pack),
      references: this.referencesFor(pack),
    };
  }

  listReferences(): readonly Reference[] {
    return this.repo.references();
  }

  packCount(): number {
    return this.repo.packs().length;
  }

  private referencesFor(pack: Pack): Reference[] {
    const all = this.repo.references();
    return pack.references
      .map((id) => all.find((r) => r.id === id))
      .filter((r): r is Reference => r !== undefined);
  }
}
