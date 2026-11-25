/**
 * Spaced review (D-056): a mastered item comes back after growing gaps, so learning sticks.
 * Mastered = completed, and its best check or simulation score (if it has one) is at least 2/3.
 * Gaps after the 1st, 2nd, 3rd, 4th and later completions: 3, 7, 21, 60 and 120 days.
 */
import type { ItemMeta } from '../catalog';
import type { ChildProgress } from './progress';

export const REVIEW_GAPS_DAYS = [3, 7, 21, 60, 120];
const DAY = 86400_000;

export function isMastered(p: ChildProgress, itemId: string): boolean {
  if (!(p.completed.get(itemId) ?? 0)) return false;
  const best = p.checkScores.get(itemId);
  return best === undefined || best >= 0.67;
}

/** When the next review is due, or undefined for items that are not reviewed. */
export function nextReviewAt(p: ChildProgress, item: Pick<ItemMeta, 'id' | 'kind'>): number | undefined {
  if (item.kind === 'project' || item.kind === 'world-project') return undefined;
  if (!isMastered(p, item.id)) return undefined;
  const times = p.completed.get(item.id) ?? 0;
  const last = p.lastDone.get(item.id) ?? 0;
  return last + REVIEW_GAPS_DAYS[Math.min(times, REVIEW_GAPS_DAYS.length) - 1] * DAY;
}

export function isReviewDue(p: ChildProgress, item: Pick<ItemMeta, 'id' | 'kind'>, now: number): boolean {
  const at = nextReviewAt(p, item);
  return at !== undefined && now >= at;
}

/** Items due for review now, most overdue first. */
export function dueReviews(p: ChildProgress, items: ItemMeta[], now: number): ItemMeta[] {
  return items
    .map((i) => ({ i, at: nextReviewAt(p, i) }))
    .filter((x) => x.at !== undefined && now >= x.at)
    .sort((a, b) => a.at! - b.at!)
    .map((x) => x.i);
}
