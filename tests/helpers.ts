import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AREA_IDS, type AreaPack } from '../src/core/content-types';
import { buildCatalog, type Catalog } from '../src/core/catalog';
import { newChild, DEFAULT_FAMILY_SETTINGS, type Child, type Family } from '../src/core/model';

export const root = join(__dirname, '..');
export function loadPacks(): AreaPack[] {
  return AREA_IDS.map((a) => JSON.parse(readFileSync(join(root, 'content', 'areas', `${a}.json`), 'utf8')));
}
let cached: Catalog | undefined;
export function catalog(): Catalog {
  cached ??= buildCatalog(loadPacks(), 'test');
  return cached;
}
export const NOW = new Date('2026-11-25T10:00:00Z').getTime();
export function child(p: Partial<Child> = {}): Child {
  return newChild({ id: p.id ?? 'c1', familyId: 'f1', name: p.name ?? 'Asha', birth: p.birth ?? '2018-03', ...p });
}
export function family(p: Partial<Family> = {}): Family {
  return { id: 'f1', name: 'Test', mode: 'A', country: 'IN', settings: { ...DEFAULT_FAMILY_SETTINGS }, updatedAt: NOW, ...p };
}
