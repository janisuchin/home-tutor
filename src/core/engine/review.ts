/**
 * Review edition helpers (DECISIONS D-051): the Browse everything catalogue and the View as panel.
 * Pure functions, so they are unit tested and work offline.
 */
import { AGE_BANDS, type AgeBand, type AreaId, type Career, type HealthModule, type SafetyRating } from '../content-types';
import type { Catalog } from '../catalog';
import { newChild, type Child, type Family } from '../model';
import { isVisible } from './gating';
import { todayPlan, type Recommendation } from './recommend';

export type EntryType =
  | 'lesson'
  | 'activity'
  | 'simulation'
  | 'project'
  | 'world-project'
  | 'skill-tree'
  | 'competency'
  | 'pathway'
  | 'career'
  | 'book';

export const ENTRY_TYPES: EntryType[] = ['lesson', 'activity', 'simulation', 'project', 'world-project', 'skill-tree', 'competency', 'pathway', 'career', 'book'];

export interface CatalogueEntry {
  type: EntryType;
  id: string;
  title: string;
  emoji: string;
  area: AreaId;
  ageBands: AgeBand[];
  rating?: SafetyRating;
  healthModule?: HealthModule;
  /** Where the entry opens (relative to a learner, e.g. item/<id>), when it has a screen. */
  open?: string;
}

/** A book as far as the catalogue needs it (the full list lives in content/books.json). */
export interface BookLike {
  id: string;
  title: string;
  band: AgeBand;
  areas: AreaId[];
}

/** Everything in one list: items, skill trees, passport competencies, pathways, careers and books. */
export function allEntries(catalog: Catalog, careers: Career[] = [], books: BookLike[] = []): CatalogueEntry[] {
  const out: CatalogueEntry[] = [];
  const bandsOf = (pred: (i: Catalog['items'][number]) => boolean): AgeBand[] => {
    const s = new Set<AgeBand>();
    for (const i of catalog.items) if (pred(i)) i.ageBands.forEach((b) => s.add(b));
    return AGE_BANDS.filter((b) => s.has(b));
  };
  for (const i of catalog.items)
    out.push({ type: i.kind, id: i.id, title: i.title, emoji: i.emoji, area: i.area, ageBands: i.ageBands, rating: i.rating, healthModule: i.healthModule, open: `item/${i.id}` });
  for (const t of catalog.skillTrees)
    out.push({ type: 'skill-tree', id: t.id, title: t.title, emoji: t.emoji, area: t.area, ageBands: bandsOf((i) => i.skills.some((s) => s.tree === t.id)), open: 'skills' });
  for (const c of catalog.competencies)
    out.push({ type: 'competency', id: c.id, title: c.title, emoji: c.emoji, area: c.area, ageBands: bandsOf((i) => i.competencies.includes(c.id)), open: 'passport' });
  for (const p of catalog.pathways)
    out.push({ type: 'pathway', id: p.id, title: p.title, emoji: p.emoji, area: p.steps[0]?.area ?? 'special-interests', ageBands: p.ageBands, open: `pathway/${p.id}` });
  for (const c of careers) out.push({ type: 'career', id: c.id, title: c.title, emoji: c.emoji, area: 'careers', ageBands: c.ageBands, open: 'careers' });
  for (const b of books) out.push({ type: 'book', id: b.id, title: b.title, emoji: '📚', area: b.areas[0] ?? 'languages', ageBands: [b.band], open: 'books' });
  return out;
}

export interface CatalogueFilter {
  area?: AreaId;
  band?: AgeBand;
  /** 'none' = entries without a safety rating. */
  rating?: SafetyRating | 'none';
  type?: EntryType;
  text?: string;
}

export function filterEntries(entries: CatalogueEntry[], f: CatalogueFilter): CatalogueEntry[] {
  const q = f.text?.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (!f.area || e.area === f.area) &&
      (!f.band || e.ageBands.includes(f.band)) &&
      (!f.rating || (f.rating === 'none' ? !e.rating : e.rating === f.rating)) &&
      (!f.type || e.type === f.type) &&
      (!q || e.title.toLowerCase().includes(q) || e.id.includes(q)),
  );
}

export type ViewAsGroup = 'girl' | 'boy' | 'mixed';

/** View-as learners get the normal edition's gates, even in the review edition. */
export const VIEW_AS_PREFIX = 'viewas-';

/**
 * The learner(s) the View as panel stands in for: one girl, one boy, or a mixed group of a girl and
 * a boy of the same age. `health` = the parent switched on the health lessons that fit them.
 */
export function viewAsChildren(age: number, group: ViewAsGroup, health: boolean, now = new Date()): Child[] {
  const birth = `${now.getFullYear() - age}-${String(Math.max(1, now.getMonth())).padStart(2, '0')}`;
  const make = (sex: 'girl' | 'boy') =>
    newChild({
      id: `${VIEW_AS_PREFIX}${age}-${sex}`,
      familyId: 'review',
      name: `${sex === 'girl' ? 'Girl' : 'Boy'}, ${age}`,
      birth,
      sex,
      health: {
        modules: health ? { 'body-basics': true, 'adolescent-health': true, [sex === 'girl' ? 'growing-up-girl' : 'growing-up-boy']: true } : {},
        guidance: 'parent',
      },
    });
  return group === 'mixed' ? [make('girl'), make('boy')] : [make(group)];
}

export interface ViewAsResult {
  /** Items the learner (or every member of the group) would see in the normal edition. */
  visible: Catalog['items'];
  perArea: Partial<Record<AreaId, number>>;
  /** Today's plan for the first learner (for a group: only items every member may do). */
  plan: Recommendation[];
  healthItems: number;
}

export function viewAs(catalog: Catalog, children: Child[], family: Family | undefined, now = Date.now()): ViewAsResult {
  const group = children.length > 1;
  const visible = catalog.items.filter((i) => children.every((c) => isVisible(i, c, family, new Date(now), { strict: true })) && (!group || !i.healthModule));
  const perArea: Partial<Record<AreaId, number>> = {};
  for (const i of visible) perArea[i.area] = (perArea[i.area] ?? 0) + 1;
  const ids = new Set(visible.map((i) => i.id));
  const plan = todayPlan(children[0], family, { ...catalog, items: catalog.items.filter((i) => ids.has(i.id)) }, [], now, true);
  return { visible, perArea, plan, healthItems: visible.filter((i) => i.healthModule).length };
}
