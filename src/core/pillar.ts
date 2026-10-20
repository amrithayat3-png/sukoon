import type { RouteDef } from './route.js';

/**
 * A pillar is a self-contained capability that owns its routes, its rules and its
 * tests. The composition root (composition.ts) builds the services each pillar
 * needs and collects the routes. Adding a capability means adding a pillar, not
 * editing existing ones.
 */
export interface Pillar {
  readonly name: string;
  routes(): RouteDef[];
}
