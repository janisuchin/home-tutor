import { describe, expect, it } from 'vitest';
import { tutorActivity } from '../src/core/engine/tutor-activity';
import type { ProgressEvent } from '../src/core/model';

const NOW = Date.UTC(2026, 10, 25);
const DAY = 86400_000;
const ev = (p: Partial<ProgressEvent>): ProgressEvent => ({ id: Math.random().toString(36), childId: 'asha', at: NOW - DAY, type: 'minutes', by: 'tutor', tutorLinkId: 'L1', ...p });

describe('parent view of tutor activity', () => {
  it('summarises one tutor’s last 30 days, newest first, with notes', () => {
    const events = [
      ev({ minutes: 30, text: 'Times tables', at: NOW - 2 * DAY }),
      ev({ minutes: 45, at: NOW - DAY }),
      ev({ type: 'completed', itemId: 'x' }),
      ev({ minutes: 60, at: NOW - 40 * DAY }), // too old
      ev({ minutes: 60, tutorLinkId: 'L2' }), // another tutor
      ev({ minutes: 60, by: 'parent', tutorLinkId: undefined }),
    ];
    const a = tutorActivity(events, 'L1', NOW);
    expect(a).toMatchObject({ sessions: 2, minutes: 75, itemsDone: 1 });
    expect(a.recent.map((r) => r.note).filter(Boolean)).toEqual(['Times tables']);
    expect(a.recent[0].at).toBeGreaterThanOrEqual(a.recent[1].at);
    expect(tutorActivity([], 'L1', NOW)).toMatchObject({ sessions: 0, minutes: 0, itemsDone: 0, recent: [] });
  });
});
