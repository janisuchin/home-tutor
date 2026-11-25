import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hrefToPath, matchPath, parseQuery, sortPatterns } from '../src/nav/match';
import { root } from './helpers';

describe('web router shim', () => {
  const patterns = sortPatterns(['/', '/passport/[code]', '/passport/open', '/learn/[childId]', '/learn/[childId]/item/[itemId]', '/parent/child/[id]', '/parent/child-edit']);
  it('matches static routes before dynamic ones and extracts params', () => {
    expect(matchPath(patterns, '/passport/open')).toEqual({ pattern: '/passport/open', params: {} });
    expect(matchPath(patterns, '/passport/ABCD-EFGH')).toEqual({ pattern: '/passport/[code]', params: { code: 'ABCD-EFGH' } });
    expect(matchPath(patterns, '/learn/c1/item/life-fix?x=1')).toEqual({ pattern: '/learn/[childId]/item/[itemId]', params: { childId: 'c1', itemId: 'life-fix' } });
    expect(matchPath(patterns, '/')).toEqual({ pattern: '/', params: {} });
    expect(matchPath(patterns, '/parent/child-edit')?.pattern).toBe('/parent/child-edit');
    expect(matchPath(patterns, '/nope')).toBeUndefined();
    expect(matchPath(patterns, '/learn/a%20b')?.params.childId).toBe('a b');
  });
  it('parses queries and builds hrefs', () => {
    expect(parseQuery('?first=1&a=b')).toEqual({ first: '1', a: 'b' });
    expect(hrefToPath('/parent/child-edit?first=1')).toBe('/parent/child-edit?first=1');
    expect(hrefToPath({ pathname: '/learn/[childId]', params: { childId: 'c 1', tab: 'x' } })).toBe('/learn/c%201?tab=x');
  });
  it('the route table lists every screen in src/app exactly once', () => {
    const app = join(root, 'src', 'app');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const screens = walk(app)
      .filter((f) => f.endsWith('.tsx') && !f.split('/').pop()!.startsWith('_'))
      .map((f) => f.slice(app.length, -4));
    const table = readFileSync(join(root, 'src', 'nav', 'routes.web.ts'), 'utf8');
    const listed = [...table.matchAll(/import\('\.\.\/app([^']+)'\)/g)].map((m) => m[1]).filter((p) => !p.endsWith('/_layout'));
    expect(listed.sort()).toEqual(screens.sort());
    for (const f of walk(app).filter((x) => x.endsWith('_layout.tsx') && !x.endsWith(join('app', '_layout.tsx')))) expect(table).toContain(f.slice(app.length, -4));
  });
});
