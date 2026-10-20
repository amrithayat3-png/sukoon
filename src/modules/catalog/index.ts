import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';
import type { CatalogService } from './service.js';

export function createCatalogPillar(catalog: CatalogService): Pillar {
  return {
    name: 'catalog',
    routes(): RouteDef[] {
      return [
        {
          method: 'GET',
          path: '/api/v1/tracks',
          auth: 'clinician',
          handler: () => ({ tracks: catalog.listTracks() }),
        },
        {
          method: 'GET',
          path: '/api/v1/tracks/:trackId/packs',
          auth: 'clinician',
          handler: ({ params }) => ({ packs: catalog.listPacks(params['trackId'] ?? '') }),
        },
        {
          method: 'GET',
          path: '/api/v1/packs/:packId',
          auth: 'clinician',
          handler: ({ params }) => catalog.getPackDetail(params['packId'] ?? ''),
        },
        {
          method: 'GET',
          path: '/api/v1/references',
          auth: 'clinician',
          handler: () => ({ references: catalog.listReferences() }),
        },
      ];
    },
  };
}
