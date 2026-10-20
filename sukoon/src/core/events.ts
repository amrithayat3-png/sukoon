import { EventEmitter } from 'node:events';

/**
 * Typed in-process event bus. Pillars publish facts about what happened and never
 * call each other directly for side effects. Subscribers (audit log today, analytics
 * or AI jobs later) can be added without touching the publisher.
 *
 * Payloads must never contain patient responses or free-text identifiers.
 */
export interface DomainEvents {
  'session.created': { sessionId: string; packId: string; keyId: string };
  'session.completed': { sessionId: string; packId: string; keyId: string };
  'session.erased': { sessionId: string; reason: 'clinician' | 'expired' };
}

export type EventName = keyof DomainEvents;

export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor(private readonly onHandlerError: (event: EventName, error: unknown) => void = () => {}) {}

  on<K extends EventName>(event: K, handler: (payload: DomainEvents[K]) => void): void {
    this.emitter.on(event, (payload: DomainEvents[K]) => {
      try {
        handler(payload);
      } catch (error) {
        this.onHandlerError(event, error);
      }
    });
  }

  emit<K extends EventName>(event: K, payload: DomainEvents[K]): void {
    this.emitter.emit(event, payload);
  }
}
