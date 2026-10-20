import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import type { Config } from './config/env.js';
import type { ComposeOptions } from './composition.js';
import { composePlatform } from './composition.js';
import { toErrorResponse } from './core/http.js';
import { registerRoutes } from './http/fastify-adapter.js';

export interface BuildOptions extends Omit<ComposeOptions, 'logger'> {
  config: Config;
}

function loggerOptions(config: Config) {
  return {
    level: config.logLevel,
    redact: { paths: ['req.headers.authorization'], censor: '[redacted]' },
    ...(config.nodeEnv === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : {}),
  };
}

export async function buildApp(options: BuildOptions): Promise<FastifyInstance> {
  const { config, ...composeOptions } = options;
  const isProduction = config.nodeEnv === 'production';

  const app = Fastify({
    logger: loggerOptions(config),
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    trustProxy: isProduction,
    bodyLimit: 64 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      // Only upgrade to https in production, otherwise local http development breaks in some browsers.
      directives: { 'upgrade-insecure-requests': isProduction ? [] : null },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, { max: config.rateLimitPerMinute, timeWindow: '1 minute' });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    if (request.url.startsWith('/api/') || request.url === '/ready') {
      reply.header('cache-control', 'no-store');
    }
    return payload;
  });

  const platform = await composePlatform(config, { ...composeOptions, logger: app.log });
  registerRoutes(app, platform.routes, platform.authenticate);

  app.setErrorHandler((error, request, reply) => {
    const response = toErrorResponse(error);
    if (!response.expose) request.log.error({ err: error }, 'Unhandled error');
    void reply.code(response.status).send(response.body);
  });
  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  await app.register(fastifyStatic, {
    root: config.webDir,
    prefix: '/',
    index: ['index.html'],
    maxAge: isProduction ? '10m' : 0,
  });

  app.addHook('onReady', async () => platform.start());
  app.addHook('onClose', async () => platform.stop());

  return app;
}
