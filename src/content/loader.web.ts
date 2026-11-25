/**
 * Web content loader: content packs are static files on the Cloudflare edge, fetched on demand
 * and cached by the service worker, so the JavaScript bundle stays small for slow connections.
 */
import type { Catalog } from '../core/catalog';
import type { AreaPack, Career, EmergencyNumber, VocabPack } from '../core/content-types';

let catalog: Catalog | undefined;
const packCache = new Map<string, AreaPack>();
const jsonCache = new Map<string, unknown>();

async function getJson<T>(path: string): Promise<T> {
  if (jsonCache.has(path)) return jsonCache.get(path) as T;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`content ${path}: ${res.status}`);
  const data = (await res.json()) as T;
  jsonCache.set(path, data);
  return data;
}

export async function loadCatalog(): Promise<Catalog> {
  if (!catalog) catalog = await getJson<Catalog>('/content/catalog.json');
  return catalog;
}

export function getCatalogSync(): Catalog | undefined {
  return catalog;
}

export async function loadPack(area: string): Promise<AreaPack> {
  if (!packCache.has(area)) packCache.set(area, await getJson<AreaPack>(`/content/areas/${area}.json`));
  return packCache.get(area)!;
}

export const loadEmergencyNumbers = () => getJson<EmergencyNumber[]>('/content/emergency-numbers.json');
export const loadCareers = () => getJson<Career[]>('/content/careers.json');
export const loadVocab = (code: string) => getJson<VocabPack>(`/content/languages/${code}.json`).catch(() => undefined);

/** Fetch every pack once so the service worker keeps them for offline use. */
export async function downloadAllForOffline(onProgress?: (done: number, total: number) => void): Promise<number> {
  const c = await loadCatalog();
  const langs = ['ja', 'de', 'ru', 'zh', 'ar', 'fr', 'hi', 'gu', 'es'];
  const paths = [
    ...c.areas.map((a) => `/content/areas/${a.area}.json`),
    '/content/emergency-numbers.json',
    '/content/careers.json',
    ...langs.map((l) => `/content/languages/${l}.json`),
  ];
  let done = 0;
  for (const p of paths) {
    await fetch(p).catch(() => undefined);
    done++;
    onProgress?.(done, paths.length);
  }
  return paths.length;
}
