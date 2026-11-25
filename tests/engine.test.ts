import { describe, expect, it } from 'vitest';
import { catalog, child, family, NOW } from './helpers';
import { ageBandFor, ageFromBirth, ageLookFor, type ProgressEvent } from '../src/core/model';
import { recommend, todayPlan, currentMission } from '../src/core/engine/recommend';
import { deriveProgress } from '../src/core/engine/progress';
import { isVisible, visibilityFor } from '../src/core/engine/gating';
import { tutorInsights, groupCompatibility, achievements } from '../src/core/engine/insights';
import { buildPassport } from '../src/core/engine/passport';
import { minutesLeft, addUsage, dayKey } from '../src/core/screen-time';

const now = new Date(NOW);
let n = 0;
const ev = (e: Partial<ProgressEvent>): ProgressEvent => ({ id: `e${n++}`, childId: 'c1', at: NOW - 3600_000, type: 'completed', by: 'child', ...e });

describe('age and levels', () => {
  it('computes age from birth year and month', () => {
    expect(ageFromBirth('2018-03', now)).toBe(8);
    expect(ageFromBirth('2018-12', now)).toBe(7);
  });
  it('maps ages to bands and looks', () => {
    expect(ageBandFor(4)).toBe('3-5');
    expect(ageBandFor(8)).toBe('6-8');
    expect(ageBandFor(16)).toBe('15-17');
    expect(ageLookFor(4)).toBe('picture');
    expect(ageLookFor(8)).toBe('simple');
    expect(ageLookFor(12)).toBe('full');
  });
  it('keeps learning level separate from age (brief section 24)', () => {
    const c = child({ levelOverrides: { mathematics: 8 } });
    const p = deriveProgress(c, [], catalog(), NOW);
    expect(p.subjectLevels.get('mathematics')).toBe(8);
    expect(p.subjectLevels.get('reading') ?? 0).toBeLessThan(8);
  });
});

describe('health gating (owner decision 4)', () => {
  const healthItems = () => catalog().items.filter((i) => i.healthModule);
  it('hides every health module by default', () => {
    const c = child({ birth: '2014-01', sex: 'girl' });
    expect(healthItems().length).toBeGreaterThan(10);
    for (const i of healthItems()) expect(isVisible(i, c, family(), now)).toBe(false);
  });
  it('shows a module only when the parent switches it on, and only in its age bands', () => {
    const c = child({ birth: '2014-01', sex: 'girl', health: { modules: { 'growing-up-girl': true }, guidance: 'parent' } });
    const girl = healthItems().filter((i) => i.healthModule === 'growing-up-girl');
    expect(girl.some((i) => isVisible(i, c, family(), now))).toBe(true);
    const boy = healthItems().filter((i) => i.healthModule === 'growing-up-boy');
    expect(boy.every((i) => !isVisible(i, c, family(), now))).toBe(true);
    const little = child({ birth: '2022-01', health: { modules: { 'growing-up-girl': true }, guidance: 'parent' } });
    expect(girl.every((i) => !isVisible(i, little, family(), now))).toBe(true);
  });
  it('never limits non-health learning by sex', () => {
    const g = child({ sex: 'girl' });
    const b = child({ sex: 'boy' });
    const vg = catalog().items.filter((i) => !i.healthModule && isVisible(i, g, family(), now)).map((i) => i.id);
    const vb = catalog().items.filter((i) => !i.healthModule && isVisible(i, b, family(), now)).map((i) => i.id);
    expect(vg).toEqual(vb);
  });
  it('respects areas switched off and the worldview setting', () => {
    const c = child({ areasOff: ['financial-literacy'] });
    expect(catalog().items.filter((i) => i.area === 'financial-literacy').every((i) => !isVisible(i, c, family(), now))).toBe(true);
    const item = catalog().items.find((i) => i.area === 'first-aid' && i.rating === 'red');
    if (item) {
      const v = visibilityFor(item, child({ birth: '2010-01' }), family(), now);
      if (v.visible) expect(v.needsProfessional).toBe(true);
    }
  });
});

describe('what-next engine (brief section 41)', () => {
  it('ranks horse items high for a child who loves horses (the horse pathway example)', () => {
    const c = child({ interests: ['horses'] });
    const recs = recommend(c, family(), catalog(), [], { now: NOW });
    const top = recs.slice(0, 15);
    expect(top.some((r) => r.item.interests.includes('horses'))).toBe(true);
    expect(top.find((r) => r.item.interests.includes('horses'))!.reasons.some((x) => x.key === 'reason.interest')).toBe(true);
  });
  it('ranks bicycle items high for a child who loves bicycles', () => {
    const c = child({ interests: ['bicycles'], sex: 'boy' });
    const recs = recommend(c, family(), catalog(), [], { now: NOW }).slice(0, 15);
    expect(recs.some((r) => r.item.interests.includes('bicycles'))).toBe(true);
  });
  it('builds a balanced daily plan with physical activity and no projects', () => {
    const plan = todayPlan(child(), family(), catalog(), [], NOW);
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(new Set(plan.map((p) => p.item.area)).size).toBe(plan.length);
    expect(plan.some((p) => p.item.area === 'physical-education')).toBe(true);
    expect(plan.every((p) => p.item.kind !== 'project' && p.item.kind !== 'world-project')).toBe(true);
  });
  it('plan size follows intensity', () => {
    const light = todayPlan(child(), family({ settings: { ...family().settings, intensity: 'light' } }), catalog(), [], NOW);
    const full = todayPlan(child({ dailyMinutes: 0 }), family({ settings: { ...family().settings, intensity: 'full' } }), catalog(), [], NOW);
    expect(light.length).toBeLessThan(full.length);
  });
  it('a mission is a project', () => {
    const m = currentMission(child(), family(), catalog(), [], NOW);
    expect(m && ['project', 'world-project'].includes(m.item.kind)).toBe(true);
  });
  it('moves completed items down and offers a retry after a failed check', () => {
    const c = child();
    const first = recommend(c, family(), catalog(), [], { now: NOW })[0];
    const done = [ev({ itemId: first.item.id })];
    const after = recommend(c, family(), catalog(), done, { now: NOW });
    expect(after[0].item.id).not.toBe(first.item.id);
    const failed = [ev({ itemId: first.item.id }), ev({ type: 'check', itemId: first.item.id, score: 0.2 })];
    const retry = recommend(c, family(), catalog(), failed, { now: NOW }).find((r) => r.item.id === first.item.id)!;
    expect(retry.reasons.some((r) => r.key === 'reason.retry')).toBe(true);
  });
  it('raises the subject level when the child masters items', () => {
    const c = child();
    const maths = catalog().items.filter((i) => i.subject === 'mathematics').sort((a, b) => b.level - a.level)[0];
    const p = deriveProgress(c, [ev({ itemId: maths.id }), ev({ type: 'check', itemId: maths.id, score: 1 })], catalog(), NOW);
    expect(p.subjectLevels.get('mathematics')).toBe(Math.min(10, maths.level + 1));
  });
});

describe('competency passport (brief section 27)', () => {
  const comp = () => catalog().items.find((i) => i.practical && i.competencies.length)!;
  it('completing gives Knows; passing a check gives Understands', () => {
    const it0 = comp();
    const p = deriveProgress(child(), [ev({ itemId: it0.id }), ev({ type: 'check', itemId: it0.id, score: 1 })], catalog(), NOW);
    expect(p.stages.get(it0.competencies[0])).toBe('understands');
  });
  it('Can demonstrate and above count only when an adult confirms', () => {
    const cid = comp().competencies[0];
    const byChild = deriveProgress(child(), [ev({ type: 'stage', competencyId: cid, stage: 'can-teach', by: 'child' })], catalog(), NOW);
    expect(byChild.stages.get(cid)).toBeUndefined();
    const byParent = deriveProgress(child(), [ev({ type: 'stage', competencyId: cid, stage: 'can-apply', by: 'parent' })], catalog(), NOW);
    expect(byParent.stages.get(cid)).toBe('can-apply');
    expect(byParent.realWorld).toBe(1);
  });
  it('builds a passport snapshot with only a first name and no contact data', () => {
    const it0 = comp();
    const snap = buildPassport(child({ name: 'Asha' }), [ev({ itemId: it0.id }), ev({ type: 'book', text: 'Matilda' })], catalog(), NOW);
    expect(snap.name).toBe('Asha');
    expect(snap.competencies.length).toBeGreaterThan(0);
    expect(snap.books).toEqual(['Matilda']);
    const text = JSON.stringify(snap);
    expect(text).not.toMatch(/@|birth|familyId/);
  });
});

describe('tutor insights and groups (brief section 33)', () => {
  it('suggests connecting fractions to recipes for a child who loves cooking', () => {
    const ins = tutorInsights(child({ interests: ['cooking'] }), family(), catalog(), [], NOW);
    const c = ins.find((i) => i.kind === 'connect-interest');
    expect(c).toBeTruthy();
    expect(String(c!.reason.vars!.lesson).toLowerCase()).toMatch(/fraction|recipe|cook|measure/);
  });
  it('detects rapid progress in a subject', () => {
    const items = catalog().items.filter((i) => i.subject === 'mathematics').slice(0, 3);
    const events = items.flatMap((i) => [ev({ itemId: i.id, at: NOW - 86400_000 }), ev({ type: 'check', itemId: i.id, score: 1, at: NOW - 86400_000 })]);
    const ins = tutorInsights(child(), family(), catalog(), events, NOW);
    expect(ins.some((i) => i.kind === 'accelerate')).toBe(true);
  });
  it('group compatibility never shares health lessons', () => {
    const kids = [child({ id: 'a', health: { modules: { 'body-basics': true }, guidance: 'parent' }, interests: ['animals'] }), child({ id: 'b', birth: '2019-05', health: { modules: { 'body-basics': true }, guidance: 'parent' }, interests: ['animals'] })];
    const g = groupCompatibility(kids, family(), catalog(), NOW);
    expect(g.sharedItems.length).toBeGreaterThan(0);
    expect(g.sharedItems.every((i) => !i.healthModule)).toBe(true);
    expect(g.sharedInterests).toContain('animals');
    expect(g.score).toBeGreaterThan(40);
  });
  it('achievements reward effort and persistence and are never lost', () => {
    const p = deriveProgress(child(), [ev({ itemId: catalog().items[0].id }), ev({ type: 'check', itemId: catalog().items[0].id, score: 1, retry: true })], catalog(), NOW);
    const a = achievements(p);
    expect(a.find((x) => x.id === 'first-step')!.earned).toBe(true);
    expect(a.find((x) => x.id === 'try-again')!.earned).toBe(true);
    expect(a.some((x) => x.id.includes('streak'))).toBe(false);
  });
});

describe('screen time', () => {
  it('counts down and resets each day, with parent extra minutes', () => {
    let u = addUsage(undefined, 30 * 60, NOW);
    expect(minutesLeft(60, u, NOW)).toBe(30);
    u = { ...u, extraMinutes: 15 };
    expect(minutesLeft(60, u, NOW)).toBe(45);
    expect(minutesLeft(60, u, NOW + 86400_000)).toBe(60);
    expect(minutesLeft(0, u, NOW)).toBe(Infinity);
    expect(dayKey(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('class report', async () => {
  const { buildClassReport } = await import('../src/core/engine/class-report');
  const { child: mk } = await import('./helpers');
  const now = new Date('2026-11-25T12:00:00').getTime();
  const day = (d: number) => new Date(now - d * 86400_000);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const group = { id: 'g1', name: 'Class 4', kind: 'classroom' as const, childIds: ['a', 'b', 'gone'], updatedAt: 1 };
  const kids = [mk({ id: 'a', name: 'Ana' }), mk({ id: 'b', name: 'Ben' }), { ...mk({ id: 'gone', name: 'Old' }), deleted: true }];
  const attendance = { [key(day(1))]: ['a', 'b'], [key(day(2))]: ['a'], [key(day(3))]: [], [key(day(40))]: ['b'] };
  const events = [
    { id: 'e1', childId: 'a', at: day(1).getTime(), type: 'completed' as const, itemId: 'x', by: 'tutor' as const, groupId: 'g1' },
    { id: 'e2', childId: 'a', at: day(2).getTime(), type: 'check' as const, score: 0.5, by: 'child' as const },
    { id: 'e3', childId: 'a', at: day(2).getTime(), type: 'check' as const, score: 1, by: 'child' as const },
    { id: 'e4', childId: 'b', at: day(1).getTime(), type: 'minutes' as const, minutes: 20, by: 'child' as const },
    { id: 'e5', childId: 'b', at: day(50).getTime(), type: 'completed' as const, itemId: 'y', by: 'child' as const },
    { id: 'e6', childId: 'b', at: day(1).getTime(), type: 'stage' as const, competencyId: 'c', stage: 'can-apply' as const, by: 'parent' as const },
  ];
  it('counts sessions, attendance and progress in the period only, without deleted children', () => {
    const r = buildClassReport(group, kids, attendance, events as any, undefined, { days: 30, now });
    expect(r.sessions).toBe(2); // empty days and days outside the period do not count
    expect(r.rows.map((x) => x.name)).toEqual(['Ana', 'Ben']);
    const [ana, ben] = r.rows;
    expect(ana).toMatchObject({ present: 2, attendancePct: 100, completed: 1, groupLessons: 1, checks: 2, avgScore: 75 });
    expect(ben).toMatchObject({ present: 1, attendancePct: 50, completed: 0, minutes: 20, confirmedStages: 1 });
    expect(r.averageAttendancePct).toBe(75);
    const longer = buildClassReport(group, kids, attendance, events as any, undefined, { days: 90, now });
    expect(longer.sessions).toBe(3);
    expect(longer.rows[1].completed).toBe(1);
  });
});
