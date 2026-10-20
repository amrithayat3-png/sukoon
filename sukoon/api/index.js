// Vercel serverless entry. The app is built once per warm instance and reused.
// Requires `npm run build` first (vercel.json runs it). Sessions must use STORE_DRIVER=redis.
import { buildApp } from '../dist/app.js';
import { loadConfig } from '../dist/config/env.js';

let ready;

export default async function handler(req, res) {
  ready ??= buildApp({ config: loadConfig(process.env) }).then(async (app) => {
    await app.ready();
    return app;
  });
  let app;
  try {
    app = await ready;
  } catch (error) {
    ready = undefined; // allow a retry on the next request
    console.error(error instanceof Error ? error.message : error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'STARTUP_FAILED', message: 'Server failed to start. Check the deployment logs.' } }));
    return;
  }
  app.server.emit('request', req, res);
}
