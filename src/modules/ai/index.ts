import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';
import type { AiRegistry } from './registry.js';

export type { AiAdapters, AiCapability } from './registry.js';
export { AiRegistry, createAiRegistry } from './registry.js';
export { InMemoryVectorStore } from './memory-vector-store.js';
export * from './ports.js';

export function createAiPillar(registry: AiRegistry): Pillar {
  return {
    name: 'ai',
    routes(): RouteDef[] {
      return [
        {
          method: 'GET',
          path: '/api/v1/ai/status',
          auth: 'clinician',
          handler: () => registry.status(),
        },
      ];
    },
  };
}
