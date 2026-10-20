import type { EventBus } from '../../core/events.js';
import type { Logger } from '../../core/logger.js';

/**
 * Subscribes to domain events and writes a privacy-safe audit trail to the log.
 * Events carry identifiers only, never answers or aliases. Swap the sink for a
 * database table or a SIEM exporter without touching the pillars that emit events.
 */
export function attachAuditLog(events: EventBus, log: Logger): void {
  events.on('session.created', (payload) => log.info({ audit: true, event: 'session.created', ...payload }));
  events.on('session.completed', (payload) => log.info({ audit: true, event: 'session.completed', ...payload }));
  events.on('session.erased', (payload) => log.info({ audit: true, event: 'session.erased', ...payload }));
}
