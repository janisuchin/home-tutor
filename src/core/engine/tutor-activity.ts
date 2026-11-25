/** What a tutor did, for the parent (D-058): built from events the server stamped with the tutor link. */
import type { ProgressEvent } from '../model';

export interface TutorActivity {
  sessions: number;
  minutes: number;
  itemsDone: number;
  lastAt?: number;
  /** Newest first. */
  recent: { id: string; at: number; childId: string; type: ProgressEvent['type']; minutes?: number; itemId?: string; note?: string }[];
}

export function tutorActivity(events: ProgressEvent[], linkId: string, now = Date.now(), days = 30, max = 10): TutorActivity {
  const from = now - days * 86400_000;
  const mine = events.filter((e) => e.by === 'tutor' && e.tutorLinkId === linkId && e.at >= from).sort((a, b) => b.at - a.at);
  const sessions = mine.filter((e) => e.type === 'minutes');
  return {
    sessions: sessions.length,
    minutes: sessions.reduce((n, e) => n + (e.minutes ?? 0), 0),
    itemsDone: mine.filter((e) => e.type === 'completed').length,
    lastAt: mine[0]?.at,
    recent: mine.slice(0, max).map((e) => ({ id: e.id, at: e.at, childId: e.childId, type: e.type, minutes: e.minutes, itemId: e.itemId, note: e.type === 'minutes' ? e.text : undefined })),
  };
}
