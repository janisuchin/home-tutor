/**
 * Local server for tests and previews: serves dist/ with SPA fallback (like Workers static assets)
 * and runs the real API handler on /api/* against an in-memory SQLite database (D1-compatible).
 * Run: npx tsx scripts/serve-dist.ts [port]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { handleApi } from '../api/src/index';
import { createTestDb } from '../api/test/d1-sqlite';

const root = join(__dirname, '..', 'dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 8787);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};
const db = createTestDb();
const env = { DB: db, PASSWORD_ITERATIONS: '20000' } as any;

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname.startsWith('/api/')) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = new Request(url, { method: req.method, headers: req.headers as any, body: body && req.method !== 'GET' ? body : undefined });
    const out = await handleApi(r, env);
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, p);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Home Tutor on http://localhost:${port}`));
