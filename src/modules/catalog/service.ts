import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import type { CatalogRepository } from './repository.js';
import type { Pack, Reference, Track } from './schema.js';
import type { PackSummary, PatientPackView } from './views.js';
import { toPatientView, toSummary } from './views.js';

export class CatalogService {
  /** When true, only packs a psychologist has signed off (status: reviewed) can be listed or started. */
  constructor(
    private readonly repo: CatalogRepository,
    private readonly onlyReviewed = false,
  ) {}

  private visible(): Pack[] {
    return this.repo.packs().filter((pack) => !this.onlyReviewed || pack.status === 'reviewed');
  }

  get reviewedOnly(): boolean {
    return this.onlyReviewed;
  }

  assertLaunchable(pack: Pack): void {
    if (this.onlyReviewed && pack.status !== 'reviewed') {
      throw new ForbiddenError('This activity is still being reviewed and cannot be started yet.');
    }
  }

  listTracks(): Array<Track & { packCount: number }> {
    return this.repo.tracks().map((track) => ({
      ...track,
      packCount: this.visible().filter((pack) => pack.track === track.id).length,
    }));
  }

  listPacks(trackId: string): PackSummary[] {
    if (!this.repo.tracks().some((track) => track.id === trackId)) {
      throw new NotFoundError('Unknown track.');
    }
    return this.visible()
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
    if (this.onlyReviewed && pack.status !== 'reviewed') throw new NotFoundError('Unknown activity pack.');
    return {
      summary: toSummary(pack),
      patientView: toPatientView(pack),
      references: this.referencesFor(pack),
    };
  }

  packIds(): string[] {
    return this.repo.packs().map((pack) => pack.id);
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
