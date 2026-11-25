import { afterEach, describe, expect, it } from 'vitest';
import { catalog, child, family, NOW } from './helpers';
import { setEditionForTests } from '../src/core/edition';
import { isVisible } from '../src/core/engine/gating';
import { recommend } from '../src/core/engine/recommend';
import { allEntries, filterEntries, viewAs, viewAsChildren } from '../src/core/engine/review';

afterEach(() => setEditionForTests('standard'));
const now = new Date(NOW);

describe('review edition (unlocked)', () => {
  it('opens every item, including health pathways, only in the unlocked edition', () => {
    const c = child({ birth: '2022-01' }); // 4 years old, health modules off
    const cat = catalog();
    const standard = cat.items.filter((i) => isVisible(i, c, family(), now)).length;
    expect(standard).toBeLessThan(cat.items.length);
    setEditionForTests('unlocked');
    expect(cat.items.filter((i) => isVisible(i, c, family(), now)).length).toBe(cat.items.length);
    expect(recommend(c, family(), cat, [], { now: NOW }).length).toBe(cat.items.length);
    // strict (View as) keeps the normal gates.
    expect(cat.items.filter((i) => isVisible(i, c, family(), now, { strict: true })).length).toBe(standard);
  });
  it('View as learners always get the normal gates', () => {
    setEditionForTests('unlocked');
    const [g] = viewAsChildren(4, 'girl', false, now);
    expect(g.id).toBe('viewas-4-girl');
    expect(catalog().items.filter((i) => isVisible(i, g, family(), now)).length).toBeLessThan(catalog().items.length);
  });
  it('View as: ages differ, health only when switched on, never in a mixed group, puberty by sex', () => {
    const cat = catalog();
    const v4 = viewAs(cat, viewAsChildren(4, 'girl', false, now), family(), NOW);
    const v16 = viewAs(cat, viewAsChildren(16, 'girl', false, now), family(), NOW);
    expect(v4.visible.map((i) => i.id)).not.toEqual(v16.visible.map((i) => i.id));
    expect(v16.healthItems).toBe(0);
    const girl = viewAs(cat, viewAsChildren(12, 'girl', true, now), family(), NOW);
    const boy = viewAs(cat, viewAsChildren(12, 'boy', true, now), family(), NOW);
    expect(girl.healthItems).toBeGreaterThan(0);
    expect(girl.visible.some((i) => i.healthModule === 'growing-up-boy')).toBe(false);
    expect(boy.visible.some((i) => i.healthModule === 'growing-up-girl')).toBe(false);
    // Non-health learning is identical for girls and boys.
    const nonHealth = (v: typeof girl) => v.visible.filter((i) => !i.healthModule).map((i) => i.id);
    expect(nonHealth(girl)).toEqual(nonHealth(boy));
    const mixed = viewAs(cat, viewAsChildren(12, 'mixed', true, now), family(), NOW);
    expect(mixed.healthItems).toBe(0);
    expect(mixed.plan.length).toBeGreaterThan(0);
  });
  it('catalogue lists every kind of entry and filters by area, band, rating and type', () => {
    const cat = catalog();
    const e = allEntries(cat, [{ id: 'vet', family: 'animals', title: 'Vet', emoji: '🐾', description: '', ageBands: ['6-8'], tryAtHome: [], subjects: [], interests: [] }], [{ id: 'b1', title: 'A book', band: '3-5', areas: ['languages'] }]);
    expect(e.length).toBe(cat.items.length + cat.skillTrees.length + cat.competencies.length + cat.pathways.length + 2);
    expect(filterEntries(e, { type: 'skill-tree' }).length).toBe(cat.skillTrees.length);
    expect(filterEntries(e, { type: 'book', band: '3-5' }).length).toBe(1);
    expect(filterEntries(e, { rating: 'red' }).every((x) => x.rating === 'red')).toBe(true);
    expect(filterEntries(e, { rating: 'none' }).every((x) => !x.rating)).toBe(true);
    expect(filterEntries(e, { area: 'health' }).every((x) => x.area === 'health')).toBe(true);
    expect(filterEntries(e, { band: '15-17' }).every((x) => x.ageBands.includes('15-17'))).toBe(true);
  });
});
