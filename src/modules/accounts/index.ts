import { z } from 'zod';
import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';
import { requirePrincipal } from '../../core/route.js';
import type { AccountService } from './service.js';
import type { UsageMeter } from './usage.js';

export { AccountService } from './service.js';
export { MemoryKv, RedisKv } from './kv.js';
export { UsageMeter } from './usage.js';
export type { KvStore } from './kv.js';

const Signup = z.object({
  inviteCode: z.string().trim().min(4).max(20),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
});
const Login = z.object({ email: z.string().trim().email().max(120), password: z.string().min(1).max(100) });
const NewOrg = z.object({
  name: z.string().trim().min(2).max(80),
  plan: z.enum(['free-pilot', 'paid']).optional(),
  monthlySessionLimit: z.number().int().min(0).max(100000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
const PatchOrg = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  plan: z.enum(['free-pilot', 'paid']).optional(),
  monthlySessionLimit: z.number().int().min(0).max(100000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  paused: z.boolean().optional(),
});

const ChangePassword = z.object({ current: z.string().min(1).max(100), next: z.string().min(8, 'Password must be at least 8 characters.').max(100) });
const Uuid = z.string().uuid();

export function createAccountsPillar(accounts: AccountService, usage: UsageMeter): Pillar {
  return {
    name: 'accounts',
    routes(): RouteDef[] {
      return [
        { method: 'POST', path: '/api/v1/accounts/signup', auth: 'public', status: 201, rateLimit: { max: 10, timeWindow: '1 minute' }, handler: (c) => accounts.signup(Signup.parse(c.body)) },
        { method: 'POST', path: '/api/v1/accounts/login', auth: 'public', rateLimit: { max: 20, timeWindow: '1 minute' }, handler: (c) => accounts.login(Login.parse(c.body)) },
        { method: 'GET', path: '/api/v1/accounts/me', auth: 'clinician', handler: (c) => accounts.me(requirePrincipal(c)) },
        { method: 'POST', path: '/api/v1/accounts/password', auth: 'clinician', rateLimit: { max: 10, timeWindow: '1 minute' }, handler: (c) => accounts.changePassword(requirePrincipal(c), ChangePassword.parse(c.body)) },
        {
          method: 'GET',
          path: '/api/v1/usage',
          auth: 'clinician',
          handler: async (c) => {
            const { orgId } = requirePrincipal(c);
            return orgId ? usage.report(orgId) : { days: [], totals: { created: 0, completed: 0 }, packs: [] };
          },
        },
        { method: 'GET', path: '/api/v1/admin/orgs/:id/users', auth: 'admin', handler: async (c) => ({ users: await accounts.listUsers(Uuid.parse(c.params['id'])) }) },
        { method: 'POST', path: '/api/v1/admin/users/:id/reset-password', auth: 'admin', rateLimit: { max: 20, timeWindow: '1 minute' }, handler: (c) => accounts.resetPassword(Uuid.parse(c.params['id'])) },
        {
          method: 'GET',
          path: '/api/v1/admin/usage',
          auth: 'admin',
          handler: async () => {
            const orgs = await accounts.listOrgs();
            return { orgs: await Promise.all(orgs.map(async (o) => ({ id: o.id, name: o.name, totals: (await usage.report(o.id, false)).totals }))) };
          },
        },
        { method: 'GET', path: '/api/v1/admin/orgs', auth: 'admin', handler: async () => ({ orgs: await accounts.listOrgs() }) },
        { method: 'POST', path: '/api/v1/admin/orgs', auth: 'admin', status: 201, handler: (c) => accounts.createOrg(NewOrg.parse(c.body)) },
        { method: 'PUT', path: '/api/v1/admin/orgs/:id', auth: 'admin', handler: (c) => accounts.updateOrg(z.string().uuid().parse(c.params['id']), PatchOrg.parse(c.body)) },
      ];
    },
  };
}
