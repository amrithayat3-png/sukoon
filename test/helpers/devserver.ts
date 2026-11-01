// Local preview shim (no fastify needed): serves web/ and the API through the in-process dispatcher.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { composePlatform } from '../../src/composition.js';
import { dispatch } from './dispatch.js';
import { testConfig } from './platform.js';

const platform = await composePlatform(testConfig({ SESSION_CREATE_LIMIT_PER_HOUR: '0' }));
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
createServer(async (req, res) => {
  const url = req.url ?? '/';
  if (url.startsWith('/api/')) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString();
    const out = await dispatch(platform, { method: req.method ?? 'GET', url, headers: { authorization: String(req.headers['authorization'] ?? '') }, ...(raw ? { body: JSON.parse(raw) } : {}) });
    res.writeHead(out.status, { 'content-type': 'application/json' }).end(JSON.stringify(out.body));
    return;
  }
  const path = normalize(url.split('?')[0] === '/' ? '/index.html' : url.split('?')[0]!).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join('web', path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'content-security-policy': csp }).end(body);
  } catch { res.writeHead(404).end('nf'); }
}).listen(4173, () => console.log('up'));
