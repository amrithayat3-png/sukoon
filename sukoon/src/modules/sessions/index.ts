import { z } from 'zod';
import type { Pillar } from '../../core/pillar.js';
import type { RouteDef } from '../../core/route.js';
import { requirePrincipal } from '../../core/route.js';
import { ID_PATTERN } from '../catalog/schema.js';
import type { SessionService } from './service.js';

const CreateBody = z.object({
  packId: z.string().regex(ID_PATTERN),
  alias: z.string().trim().max(40).optional(),
});

const ResponsesBody = z.object({
  responses: z
    .record(z.string().max(64), z.union([z.number(), z.string().max(64)]))
    .refine((value) => Object.keys(value).length <= 200, 'Too many answers in one request.'),
});

const SessionId = z.string().uuid();

export function createSessionsPillar(sessions: SessionService): Pillar {
  return {
    name: 'sessions',
    routes(): RouteDef[] {
      return [
        {
          method: 'POST',
          path: '/api/v1/sessions',
          auth: 'clinician',
          status: 201,
          handler: (context) => {
            const body = CreateBody.parse(context.body);
            return sessions.create(requirePrincipal(context), { packId: body.packId, alias: body.alias });
          },
        },
        {
          method: 'GET',
          path: '/api/v1/sessions/:id',
          auth: 'clinician',
          handler: (context) =>
            sessions.get(requirePrincipal(context), SessionId.parse(context.params['id'])),
        },
        {
          method: 'PUT',
          path: '/api/v1/sessions/:id/responses',
          auth: 'clinician',
          handler: (context) => {
            const body = ResponsesBody.parse(context.body);
            return sessions.saveResponses(
              requirePrincipal(context),
              SessionId.parse(context.params['id']),
              body.responses,
            );
          },
        },
        {
          method: 'POST',
          path: '/api/v1/sessions/:id/complete',
          auth: 'clinician',
          handler: (context) =>
            sessions.complete(requirePrincipal(context), SessionId.parse(context.params['id'])),
        },
        {
          method: 'GET',
          path: '/api/v1/sessions/:id/results',
          auth: 'clinician',
          handler: (context) =>
            sessions.results(requirePrincipal(context), SessionId.parse(context.params['id'])),
        },
        {
          method: 'DELETE',
          path: '/api/v1/sessions/:id',
          auth: 'clinician',
          status: 204,
          handler: async (context) => {
            await sessions.erase(requirePrincipal(context), SessionId.parse(context.params['id']));
          },
        },
      ];
    },
  };
}
