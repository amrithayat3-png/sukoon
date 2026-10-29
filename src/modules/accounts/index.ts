import { z } from 'zod';
import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';
import { requirePrincipal } from '../../core/route.js';
import type { AccountService } from './service.js';

export { AccountService } from './service.js';
export { MemoryKv, RedisKv } from './kv.js';
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

export function createAccountsPillar(accounts: AccountService): Pillar {
  return {
    name: 'accounts',
    routes(): RouteDef[] {
      return [
        { method: 'POST', path: '/api/v1/accounts/signup', auth: 'public', status: 201, rateLimit: { max: 10, timeWindow: '1 minute' }, handler: (c) => accounts.signup(Signup.parse(c.body)) },
        { method: 'POST', path: '/api/v1/accounts/login', auth: 'public', rateLimit: { max: 20, timeWindow: '1 minute' }, handler: (c) => accounts.login(Login.parse(c.body)) },
        { method: 'GET', path: '/api/v1/accounts/me', auth: 'clinician', handler: (c) => accounts.me(requirePrincipal(c)) },
        { method: 'GET', path: '/api/v1/admin/orgs', auth: 'admin', handler: async () => ({ orgs: await accounts.listOrgs() }) },
        { method: 'POST', path: '/api/v1/admin/orgs', auth: 'admin', status: 201, handler: (c) => accounts.createOrg(NewOrg.parse(c.body)) },
        { method: 'PUT', path: '/api/v1/admin/orgs/:id', auth: 'admin', handler: (c) => accounts.updateOrg(z.string().uuid().parse(c.params['id']), PatchOrg.parse(c.body)) },
      ];
    },
  };
}
