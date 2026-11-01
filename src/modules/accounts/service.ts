import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ConflictError, ForbiddenError, NotFoundError, TooManyRequestsError, UnauthorizedError } from '../../core/errors.js';
import { newCode, newId } from '../../core/ids.js';
import type { Principal } from '../../core/route.js';
import type { KvStore } from './kv.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface Org {
  id: string;
  name: string;
  plan: 'free-pilot' | 'paid';
  monthlySessionLimit: number;
  /** ISO date after which new sessions are refused. null means no end date. */
  expiresAt: string | null;
  paused: boolean;
  inviteCode: string;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface OrgSummary extends Org {
  users: number;
  sessionsThisMonth: number;
}

const TOKEN_DAYS = 7;
const b64 = (buf: Buffer | string): string => Buffer.from(buf).toString('base64url');
const norm = (email: string): string => email.trim().toLowerCase();

/** Institutes, psychologist accounts, sign-in tokens and plan limits. Storage-agnostic through KvStore. */
export class AccountService {
  constructor(
    private readonly kv: KvStore,
    private readonly secret: string,
    private readonly adminKey: string | undefined,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ---- passwords and tokens ----
  private async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    return `s1$${salt.toString('hex')}$${(await scrypt(password, salt, 32)).toString('hex')}`;
  }

  private async check(password: string, stored: string): Promise<boolean> {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return false;
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), 32);
    const expected = Buffer.from(hashHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  issueToken(user: User): string {
    const exp = this.clock().getTime() + TOKEN_DAYS * 86_400_000;
    const body = b64(JSON.stringify({ u: user.id, o: user.orgId, exp }));
    return `${body}.${this.sign(body)}`;
  }

  /** Returns a principal for a valid, unexpired token, otherwise null. Synchronous on purpose. */
  verifyToken(token: string | undefined): Principal | null {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = this.sign(body);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u: string; o: string; exp: number };
      if (data.exp <= this.clock().getTime()) return null;
      return { keyId: data.u, orgId: data.o, role: 'clinician' };
    } catch {
      return null;
    }
  }

  verifyAdmin(token: string | undefined): Principal | null {
    if (!this.adminKey || !token) return null;
    const a = createHash('sha256').update(token).digest();
    const b = createHash('sha256').update(this.adminKey).digest();
    return timingSafeEqual(a, b) ? { keyId: 'admin', role: 'admin' } : null;
  }

  // ---- storage helpers ----
  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  private putJson(key: string, value: unknown): Promise<void> {
    return this.kv.set(key, JSON.stringify(value));
  }
  private async orgIds(): Promise<string[]> {
    return (await this.getJson<string[]>('orgs')) ?? [];
  }
  private async userIds(orgId: string): Promise<string[]> {
    return (await this.getJson<string[]>(`org:${orgId}:users`)) ?? [];
  }
  private month(): string {
    return this.clock().toISOString().slice(0, 7);
  }

  // ---- admin ----
  async createOrg(input: { name: string; plan?: Org['plan']; monthlySessionLimit?: number; expiresAt?: string | null }): Promise<Org> {
    const org: Org = {
      id: newId(),
      name: input.name,
      plan: input.plan ?? 'free-pilot',
      monthlySessionLimit: input.monthlySessionLimit ?? 200,
      expiresAt: input.expiresAt ?? null,
      paused: false,
      inviteCode: newCode(8),
      createdAt: this.clock().toISOString(),
    };
    await this.putJson(`org:${org.id}`, org);
    await this.kv.set(`invite:${org.inviteCode}`, org.id);
    await this.putJson('orgs', [...(await this.orgIds()), org.id]);
    return org;
  }

  async updateOrg(id: string, patch: Partial<Pick<Org, 'name' | 'plan' | 'monthlySessionLimit' | 'expiresAt' | 'paused'>>): Promise<Org> {
    const org = await this.getOrg(id);
    const next: Org = { ...org, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    await this.putJson(`org:${id}`, next);
    return next;
  }

  async getOrg(id: string): Promise<Org> {
    const org = await this.getJson<Org>(`org:${id}`);
    if (!org) throw new NotFoundError('Institute not found.');
    return org;
  }

  async listOrgs(): Promise<OrgSummary[]> {
    const out: OrgSummary[] = [];
    for (const id of await this.orgIds()) {
      const org = await this.getJson<Org>(`org:${id}`);
      if (!org) continue;
      out.push({
        ...org,
        users: (await this.userIds(id)).length,
        sessionsThisMonth: Number((await this.kv.get(`usage:${id}:${this.month()}`)) ?? 0),
      });
    }
    return out;
  }

  // ---- psychologist accounts ----
  async signup(input: { inviteCode: string; name: string; email: string; password: string }): Promise<{ token: string; user: PublicUser }> {
    const orgId = await this.kv.get(`invite:${input.inviteCode.trim().toUpperCase()}`);
    if (!orgId) throw new NotFoundError('That invite code was not recognised.');
    const email = norm(input.email);
    if (await this.kv.get(`user:email:${email}`)) throw new ConflictError('An account with this email already exists. Please sign in.');
    const user: User = { id: newId(), orgId, name: input.name, email, passwordHash: await this.hash(input.password), createdAt: this.clock().toISOString() };
    await this.putJson(`user:${user.id}`, user);
    await this.kv.set(`user:email:${email}`, user.id);
    await this.putJson(`org:${orgId}:users`, [...(await this.userIds(orgId)), user.id]);
    return { token: this.issueToken(user), user: publicUser(user) };
  }

  async login(input: { email: string; password: string }): Promise<{ token: string; user: PublicUser }> {
    const email = norm(input.email);
    // Slow down guessing for one email across all serverless instances: 10 tries per 15 minutes.
    if ((await this.kv.incr(`login-attempts:${email}`, 900)) > 10) throw new TooManyRequestsError('Too many sign-in attempts. Please wait 15 minutes.');
    const id = await this.kv.get(`user:email:${email}`);
    const user = id ? await this.getJson<User>(`user:${id}`) : null;
    // Always hash, so a missing account takes the same time as a wrong password.
    const ok = user ? await this.check(input.password, user.passwordHash) : (await this.hash(input.password), false);
    if (!user || !ok) throw new UnauthorizedError('Email or password is not correct.');
    return { token: this.issueToken(user), user: publicUser(user) };
  }

  /** People in one institute, for the admin page. Never includes password data. */
  async listUsers(orgId: string): Promise<PublicUser[]> {
    await this.getOrg(orgId);
    const users: PublicUser[] = [];
    for (const id of await this.userIds(orgId)) {
      const user = await this.getJson<User>(`user:${id}`);
      if (user) users.push(publicUser(user));
    }
    return users;
  }

  /** The Sukoon team sets a one-time password and tells the person. Shown once, never stored in plain text. */
  async resetPassword(userId: string): Promise<{ user: PublicUser; temporaryPassword: string }> {
    const user = await this.getJson<User>(`user:${userId}`);
    if (!user) throw new NotFoundError('Account not found.');
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(12);
    const temporaryPassword = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    user.passwordHash = await this.hash(temporaryPassword);
    await this.putJson(`user:${user.id}`, user);
    await this.kv.del(`login-attempts:${user.email}`);
    return { user: publicUser(user), temporaryPassword };
  }

  async changePassword(principal: Principal, input: { current: string; next: string }): Promise<{ ok: true }> {
    const user = await this.getJson<User>(`user:${principal.keyId}`);
    if (!user) throw new UnauthorizedError();
    if ((await this.kv.incr(`pw-attempts:${user.id}`, 900)) > 10) throw new TooManyRequestsError('Too many attempts. Please wait 15 minutes.');
    if (!(await this.check(input.current, user.passwordHash))) throw new UnauthorizedError('Your current password is not correct.');
    user.passwordHash = await this.hash(input.next);
    await this.putJson(`user:${user.id}`, user);
    return { ok: true };
  }

  async me(principal: Principal): Promise<{ user: PublicUser; org: PublicOrg }> {
    const user = await this.getJson<User>(`user:${principal.keyId}`);
    if (!user) throw new UnauthorizedError();
    const org = await this.getOrg(user.orgId);
    return { user: publicUser(user), org: await this.publicOrg(org) };
  }

  private async publicOrg(org: Org): Promise<PublicOrg> {
    return {
      id: org.id, name: org.name, plan: org.plan, monthlySessionLimit: org.monthlySessionLimit, expiresAt: org.expiresAt, paused: org.paused,
      sessionsThisMonth: Number((await this.kv.get(`usage:${org.id}:${this.month()}`)) ?? 0),
    };
  }

  /** Called before every new session. Counts usage and enforces pause, end date and monthly cap. */
  readonly gate = {
    beforeCreate: async (principal: Principal): Promise<void> => {
      if (!principal.orgId) return;
      const org = await this.getOrg(principal.orgId);
      if (org.paused) throw new ForbiddenError('Access for your institute is paused. Please contact Sukoon.');
      if (org.expiresAt && org.expiresAt <= this.clock().toISOString()) throw new ForbiddenError('Your institute\'s access period has ended. Please contact Sukoon to continue.');
      const used = await this.kv.incr(`usage:${org.id}:${this.month()}`, 40 * 86_400);
      if (used > org.monthlySessionLimit) throw new ForbiddenError('Your institute has reached this month\'s session limit. Please contact Sukoon.');
    },
  };
}

export interface PublicUser { id: string; name: string; email: string; orgId: string }
export interface PublicOrg { id: string; name: string; plan: Org['plan']; monthlySessionLimit: number; expiresAt: string | null; paused: boolean; sessionsThisMonth: number }
const publicUser = (u: User): PublicUser => ({ id: u.id, name: u.name, email: u.email, orgId: u.orgId });
