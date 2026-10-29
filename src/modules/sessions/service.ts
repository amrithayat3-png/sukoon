import { ConflictError, NotFoundError, TooManyRequestsError } from '../../core/errors.js';
import type { EventBus } from '../../core/events.js';
import { newCode, newId } from '../../core/ids.js';
import type { Principal } from '../../core/route.js';
import type { CatalogService } from '../catalog/service.js';
import type { ScoringEngine } from '../scoring/engine.js';
import type { ResultSummary, Responses } from '../scoring/types.js';
import type { Session, SessionRepository, SessionView } from './types.js';

export interface SessionServiceDeps {
  repo: SessionRepository;
  catalog: CatalogService;
  scoring: ScoringEngine;
  events: EventBus;
  clock: () => Date;
  ttlMs: number;
  /** Max sessions one key (or the shared open key) may create per hour. */
  createLimitPerHour?: number;
  /** SaaS hook: refuses creation when an institute is paused, expired or over its plan. */
  gate?: { beforeCreate(principal: Principal): Promise<void> };
}

export interface ResultsPayload {
  session: { id: string; code: string; alias?: string; completedAt: string };
  results: ResultSummary;
}

export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  async create(principal: Principal, input: { packId: string; alias?: string | undefined }): Promise<SessionView> {
    const { repo, catalog, events, clock, ttlMs } = this.deps;
    await this.enforceCreateLimit(principal);
    await this.deps.gate?.beforeCreate(principal);
    const pack = catalog.getPack(input.packId);
    const now = clock();
    const session: Session = {
      id: newId(),
      code: newCode(),
      packId: pack.id,
      packVersion: pack.version,
      keyId: principal.keyId,
      status: 'active',
      responses: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    if (principal.orgId) session.orgId = principal.orgId;
    if (input.alias) session.alias = input.alias;
    await repo.create(session);
    events.emit('session.created', { sessionId: session.id, packId: pack.id, keyId: principal.keyId });
    return this.view(session);
  }

  async get(principal: Principal, id: string): Promise<SessionView> {
    return this.view(await this.load(principal, id));
  }

  async saveResponses(principal: Principal, id: string, incoming: Responses): Promise<SessionView> {
    const { repo, catalog, scoring, clock } = this.deps;
    const session = await this.load(principal, id);
    if (session.status === 'completed') throw new ConflictError('This session is already completed.');
    const pack = catalog.getPack(session.packId);
    const merged: Responses = { ...session.responses, ...incoming };
    scoring.validate(pack, merged, false);
    session.responses = merged;
    session.updatedAt = clock().toISOString();
    await repo.save(session);
    return this.view(session);
  }

  async complete(principal: Principal, id: string): Promise<SessionView> {
    const { repo, catalog, scoring, events, clock } = this.deps;
    const session = await this.load(principal, id);
    if (session.status === 'completed') return this.view(session);
    const pack = catalog.getPack(session.packId);
    scoring.validate(pack, session.responses, true);
    const now = clock().toISOString();
    session.status = 'completed';
    session.completedAt = now;
    session.updatedAt = now;
    await repo.save(session);
    events.emit('session.completed', { sessionId: session.id, packId: pack.id, keyId: principal.keyId });
    return this.view(session);
  }

  async results(principal: Principal, id: string): Promise<ResultsPayload> {
    const { catalog, scoring } = this.deps;
    const session = await this.load(principal, id);
    if (session.status !== 'completed' || !session.completedAt) {
      throw new ConflictError('Results are available once the session is completed.');
    }
    const pack = catalog.getPack(session.packId);
    const summary: ResultsPayload['session'] = {
      id: session.id,
      code: session.code,
      completedAt: session.completedAt,
    };
    if (session.alias) summary.alias = session.alias;
    return { session: summary, results: scoring.score(pack, session.responses) };
  }

  async erase(principal: Principal, id: string): Promise<void> {
    const session = await this.load(principal, id);
    await this.deps.repo.delete(session.id);
    this.deps.events.emit('session.erased', { sessionId: session.id, reason: 'clinician' });
  }

  /** Removes every session past its expiry. Called on a timer and safe to call at any time. */
  async purgeExpired(): Promise<number> {
    const removed = await this.deps.repo.deleteExpired(this.deps.clock().toISOString());
    for (const sessionId of removed) {
      this.deps.events.emit('session.erased', { sessionId, reason: 'expired' });
    }
    return removed.length;
  }

  private readonly localHits = new Map<string, { count: number; resetAt: number }>();

  private async enforceCreateLimit(principal: Principal): Promise<void> {
    const limit = this.deps.createLimitPerHour ?? 0;
    if (limit <= 0) return;
    const { repo, clock } = this.deps;
    let count: number;
    if (repo.increment) {
      count = await repo.increment(`sukoon:rl:create:${principal.keyId}`, 3600);
    } else {
      const now = clock().getTime();
      const entry = this.localHits.get(principal.keyId);
      if (!entry || entry.resetAt <= now) this.localHits.set(principal.keyId, { count: 1, resetAt: now + 3600_000 });
      else entry.count += 1;
      count = this.localHits.get(principal.keyId)?.count ?? 1;
    }
    if (count > limit) throw new TooManyRequestsError('Too many sessions started this hour. Please try again later.');
  }

  /** Another clinician's session is reported as missing, not forbidden, so ids reveal nothing. */
  private async load(principal: Principal, id: string): Promise<Session> {
    const session = await this.deps.repo.get(id);
    if (!session || session.keyId !== principal.keyId) throw new NotFoundError('Session not found.');
    if (session.expiresAt <= this.deps.clock().toISOString()) {
      await this.deps.repo.delete(session.id);
      this.deps.events.emit('session.erased', { sessionId: session.id, reason: 'expired' });
      throw new NotFoundError('Session not found.');
    }
    return session;
  }

  private view(session: Session): SessionView {
    const pack = this.deps.catalog.getPack(session.packId);
    const view: SessionView = {
      id: session.id,
      code: session.code,
      packId: session.packId,
      status: session.status,
      expiresAt: session.expiresAt,
      answered: Object.keys(session.responses).length,
      total: this.deps.scoring.expectedAnswers(pack),
      responses: { ...session.responses },
    };
    if (session.alias) view.alias = session.alias;
    return view;
  }
}
