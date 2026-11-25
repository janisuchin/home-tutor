/**
 * Bundle-size budget for the web build (run after `npm run build:web`; CI fails on a miss).
 * Measures every script index.html loads on the first visit, gzipped at level 9.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = join(__dirname, '..', 'dist');
export const BUDGET_ENTRY_KB = 200; // owner goal: entry bundle below 200 KB gzip
const BUDGET_CHUNK_KB = 60; // any single lazy chunk (screens, locales)

const gz = (file: string) => gzipSync(readFileSync(file), { level: 9 }).length / 1024;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
if (!entry.length) throw new Error('No entry scripts found in dist/index.html');

let failed = false;
let entryTotal = 0;
for (const src of entry) {
  const kb = gz(join(dist, src));
  entryTotal += kb;
  console.log(`entry  ${kb.toFixed(1).padStart(7)} KB gzip  ${src}`);
}
console.log(`entry total ${entryTotal.toFixed(1)} KB gzip (budget ${BUDGET_ENTRY_KB} KB)`);
if (entryTotal > BUDGET_ENTRY_KB) {
  console.error(`FAIL: entry bundle is ${entryTotal.toFixed(1)} KB gzip, over the ${BUDGET_ENTRY_KB} KB budget.`);
  failed = true;
}
const jsDir = join(dist, '_expo', 'static', 'js', 'web');
const chunks = readdirSync(jsDir).filter((f) => f.endsWith('.js') && !entry.some((e) => e.endsWith(f)));
let biggest = { f: '', kb: 0 };
for (const f of chunks) {
  const kb = gz(join(jsDir, f));
  if (kb > biggest.kb) biggest = { f, kb };
  if (kb > BUDGET_CHUNK_KB) {
    console.error(`FAIL: lazy chunk ${f} is ${kb.toFixed(1)} KB gzip, over ${BUDGET_CHUNK_KB} KB.`);
    failed = true;
  }
}
console.log(`${chunks.length} lazy chunks; largest ${biggest.f} ${biggest.kb.toFixed(1)} KB gzip (budget ${BUDGET_CHUNK_KB} KB each)`);
const total = readdirSync(jsDir).reduce((n, f) => n + statSync(join(jsDir, f)).size, 0) / 1024;
console.log(`all JS ${total.toFixed(0)} KB raw`);
process.exit(failed ? 1 : 0);
