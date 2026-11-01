import { ConflictError, ForbiddenError, NotFoundError, TooManyRequestsError, ValidationError } from '../../core/errors.js';
import type { EventBus } from '../../core/events.js';
import { newCode, newId } from '../../core/ids.js';
import type { Principal } from '../../core/route.js';
import type { CatalogService } from '../catalog/service.js';
import type { HomeworkCard, ResourceService } from '../resources/index.js';
import type { ScoringEngine } from '../scoring/engine.js';
import type { ResultSummary, Responses } from '../scoring/types.js';
import { BODY_ZONES, labelOf, MOODS, REFLECTIONS } from './extras.js';
import type { Session, SessionExtras, SessionRepository, SessionView } from './types.js';

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
  /** Homework cards, used to validate and expand the clinician's choices. */
  resources: ResourceService;
  /** SaaS hook: counts sessions for usage reports. Failures never block a session. */
  usage?: { created(principal: Principal, packId: string): Promise<void>; completed(principal: Principal, packId: string): Promise<void> };
}

export interface ExtrasInput {
  notes?: string;
  homework?: string[];
  moodStart?: string;
  moodEnd?: string;
  reflection?: string;
  bodyMap?: string[];
  consent?: boolean;
}

export interface ResultsPayload {
  session: {
    id: string;
    code: string;
    alias?: string;
    completedAt: string;
    notes?: string;
    homework: HomeworkCard[];
    moodStart?: { id: string; label: string };
    moodEnd?: { id: string; label: string };
    reflection?: { id: string; label: string };
    bodyMap: Array<{ id: string; label: string }>;
    consentAt?: string;
  };
  results: ResultSummary;
}

export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  async create(principal: Principal, input: { packId: string; alias?: string | undefined }): Promise<SessionView> {
    const { repo, catalog, events, clock, ttlMs } = this.deps;
    await this.enforceCreateLimit(principal);
    await this.deps.gate?.beforeCreate(principal);
    const pack = catalog.getPack(input.packId);
    catalog.assertLaunchable(pack);
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
    await this.deps.usage?.created(principal, pack.id).catch(() => undefined);
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
    await this.deps.usage?.completed(principal, pack.id).catch(() => undefined);
    return this.view(session);
  }

  async results(principal: Principal, id: string): Promise<ResultsPayload> {
    const { catalog, scoring } = this.deps;
    const session = await this.load(principal, id);
    if (session.status !== 'completed' || !session.completedAt) {
      throw new ConflictError('Results are available once the session is completed.');
    }
    const pack = catalog.getPack(session.packId);
    const extras = session.extras ?? {};
    const summary: ResultsPayload['session'] = {
      id: session.id,
      code: session.code,
      completedAt: session.completedAt,
      homework: (extras.homework ?? []).filter((id) => this.deps.resources.has(id)).map((id) => this.deps.resources.card(id)),
      bodyMap: (extras.bodyMap ?? []).map((id) => ({ id, label: labelOf(BODY_ZONES, id) ?? id })),
    };
    if (session.alias) summary.alias = session.alias;
    if (extras.notes) summary.notes = extras.notes;
    if (extras.consentAt) summary.consentAt = extras.consentAt;
    if (extras.moodStart) summary.moodStart = { id: extras.moodStart, label: labelOf(MOODS, extras.moodStart) ?? extras.moodStart };
    if (extras.moodEnd) summary.moodEnd = { id: extras.moodEnd, label: labelOf(MOODS, extras.moodEnd) ?? extras.moodEnd };
    if (extras.reflection) summary.reflection = { id: extras.reflection, label: labelOf(REFLECTIONS, extras.reflection) ?? extras.reflection };
    return { session: summary, results: scoring.score(pack, session.responses) };
  }

  /** Saves optional extras. Allowed before and after completion. Only fixed ids and short text are accepted. */
  async updateExtras(principal: Principal, id: string, input: ExtrasInput): Promise<SessionView> {
    const { repo, clock, resources } = this.deps;
    const session = await this.load(principal, id);
    const extras: SessionExtras = { ...(session.extras ?? {}) };
    const pick = (value: string, list: Readonly<Record<string, string>>, what: string): string => {
      if (!(value in list)) throw new ValidationError(`Unknown ${what}.`);
      return value;
    };
    if (input.notes !== undefined) {
      if (input.notes.trim()) extras.notes = input.notes.trim().slice(0, 4000);
      else delete extras.notes;
    }
    if (input.homework !== undefined) {
      const unique = [...new Set(input.homework)];
      if (unique.some((card) => !resources.has(card))) throw new ValidationError('Unknown homework card.');
      if (unique.length) extras.homework = unique;
      else delete extras.homework;
    }
    if (input.moodStart !== undefined) extras.moodStart = pick(input.moodStart, MOODS, 'mood');
    if (input.moodEnd !== undefined) extras.moodEnd = pick(input.moodEnd, MOODS, 'mood');
    if (input.reflection !== undefined) extras.reflection = pick(input.reflection, REFLECTIONS, 'reflection');
    if (input.bodyMap !== undefined) {
      const zones = [...new Set(input.bodyMap)].map((zone) => pick(zone, BODY_ZONES, 'body area'));
      if (zones.length) extras.bodyMap = zones;
      else delete extras.bodyMap;
    }
    if (input.consent) extras.consentAt = clock().toISOString();
    session.extras = extras;
    session.updatedAt = clock().toISOString();
    await repo.save(session);
    return this.view(session);
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
    if (session.extras?.consentAt) view.consentAt = session.extras.consentAt;
    return view;
  }
}
