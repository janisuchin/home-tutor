/**
 * Pure path matching for the web router shim (src/nav/expo-router.web.tsx), shared with unit tests.
 * Patterns use Expo Router's file names: "/learn/[childId]/item/[itemId]".
 */
export interface Match {
  pattern: string;
  params: Record<string, string>;
}

const segs = (p: string) => p.split('/').filter(Boolean);

/** Static segments beat dynamic ones, so "/passport/open" wins over "/passport/[code]". */
export function sortPatterns(patterns: string[]): string[] {
  const score = (p: string) => segs(p).map((s) => (s.startsWith('[') ? '1' : '0')).join('');
  return [...patterns].sort((a, b) => segs(b).length - segs(a).length || score(a).localeCompare(score(b)));
}

export function matchPath(patterns: string[], path: string): Match | undefined {
  const parts = segs(path.split(/[?#]/)[0]).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  for (const pattern of patterns) {
    const ps = segs(pattern);
    if (ps.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      const m = ps[i].match(/^\[(\w+)\]$/);
      if (m) params[m[1]] = parts[i];
      else if (ps[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { pattern, params };
  }
  return undefined;
}

export function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (!q) return out;
  for (const [k, v] of new URLSearchParams(q)) out[k] = v;
  return out;
}

/** Turns an Expo Router href (string or { pathname, params }) into a URL path with query. */
export function hrefToPath(href: string | { pathname: string; params?: Record<string, string | number | undefined> }): string {
  if (typeof href === 'string') return href.startsWith('/') ? href : `/${href}`;
  let path = href.pathname;
  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(href.params ?? {})) {
    if (v === undefined) continue;
    if (path.includes(`[${k}]`)) path = path.replace(`[${k}]`, encodeURIComponent(String(v)));
    else rest[k] = String(v);
  }
  const qs = new URLSearchParams(rest).toString();
  return qs ? `${path}?${qs}` : path;
}
