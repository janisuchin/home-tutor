import { describe, expect, it } from 'vitest';
import { catalog, child, family, NOW } from './helpers';
import type { ProgressEvent } from '../src/core/model';
import { deriveProgress } from '../src/core/engine/progress';
import { recommend, todayPlan } from '../src/core/engine/recommend';
import { dueReviews, isMastered, isReviewDue, nextReviewAt, REVIEW_GAPS_DAYS } from '../src/core/engine/spaced';

const DAY = 86400_000;
let n = 0;
const ev = (e: Partial<ProgressEvent>): ProgressEvent => ({ id: `s${n++}`, childId: 'c1', at: NOW, type: 'completed', by: 'child', ...e });

describe('spaced review of mastered items', () => {
  const kid = child({ birth: '2018-03' });
  const cat = catalog();
  const lesson = cat.items.find((i) => i.kind === 'lesson' && i.ageBands.includes('6-8'))!;
  const project = cat.items.find((i) => i.kind === 'project' && i.ageBands.includes('6-8'))!;

  it('is due after 3, 7, 21, 60 and 120 days as completions grow', () => {
    expect(REVIEW_GAPS_DAYS).toEqual([3, 7, 21, 60, 120]);
    for (let times = 1; times <= 6; times++) {
      const events = Array.from({ length: times }, (_, k) => ev({ itemId: lesson.id, at: NOW - 400 * DAY + k * DAY }));
      const last = events[events.length - 1].at;
      const p = deriveProgress(kid, events, cat, last);
      expect(nextReviewAt(p, lesson)).toBe(last + REVIEW_GAPS_DAYS[Math.min(times, 5) - 1] * DAY);
    }
  });
  it('needs mastery: a failed check is retried, not reviewed', () => {
    const done = [ev({ itemId: lesson.id, at: NOW - 10 * DAY })];
    expect(isMastered(deriveProgress(kid, done, cat, NOW), lesson.id)).toBe(true);
    const failed = [...done, ev({ type: 'check', itemId: lesson.id, score: 0.3, at: NOW - 10 * DAY })];
    const p = deriveProgress(kid, failed, cat, NOW);
    expect(isMastered(p, lesson.id)).toBe(false);
    expect(isReviewDue(p, lesson, NOW)).toBe(false);
    const passed = [...done, ev({ type: 'check', itemId: lesson.id, score: 1, at: NOW - 10 * DAY })];
    expect(isReviewDue(deriveProgress(kid, passed, cat, NOW), lesson, NOW)).toBe(true);
  });
  it('projects are never reviewed; nothing is due too early', () => {
    const p = deriveProgress(kid, [ev({ itemId: project.id, at: NOW - 100 * DAY }), ev({ itemId: lesson.id, at: NOW - 1 * DAY })], cat, NOW);
    expect(nextReviewAt(p, project)).toBeUndefined();
    expect(isReviewDue(p, lesson, NOW)).toBe(false);
    expect(dueReviews(p, cat.items, NOW)).toEqual([]);
  });
  it('the engine brings a due review back with a reason, and puts at most one in the day plan', () => {
    const done = cat.items.filter((i) => i.kind !== 'project' && i.kind !== 'world-project' && i.ageBands.includes('6-8')).slice(0, 6);
    const events = done.map((i) => ev({ itemId: i.id, at: NOW - 30 * DAY }));
    const recs = recommend(kid, family(), cat, events, { now: NOW });
    const r = recs.find((x) => x.item.id === done[0].id)!;
    expect(r.review).toBe(true);
    expect(r.reasons.map((x) => x.key)).toContain('reason.review');
    // Without the review the same item would be pushed far down.
    const fresh = recommend(kid, family(), cat, done.map((i) => ev({ itemId: i.id, at: NOW - 1 * DAY })), { now: NOW });
    expect(fresh.find((x) => x.item.id === done[0].id)!.review).toBeUndefined();
    expect(fresh.findIndex((x) => x.item.id === done[0].id)).toBeGreaterThan(recs.findIndex((x) => x.item.id === done[0].id));
    const plan = todayPlan(kid, family(), cat, events, NOW);
    expect(plan.filter((x) => x.review).length).toBeLessThanOrEqual(1);
    expect(dueReviews(deriveProgress(kid, events, cat, NOW), cat.items, NOW).length).toBe(done.length);
  });
});
