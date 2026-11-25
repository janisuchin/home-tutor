/** Pure merge for the tutor's copy of a shared family (used by src/data/tutoring.ts and the tests). */
import type { Child, ProgressEvent } from '../model';
import { pickWinner, type SyncRecord } from './merge';

export interface TutoredFamily {
  id: string; // link id
  familyLabel: string;
  childIds: string[];
  cursor: number;
  children: Record<string, Child>;
  events: ProgressEvent[];
  /** Records written on this device and not yet accepted by the server ("child:id" / "event:id"). */
  dirty: string[];
  lastSyncAt?: number;
}

/**
 * Merges a tutor sync response into one family: drops children no longer shared (and their
 * events), applies child records last-writer-wins and events by union, and clears sent records.
 */
export function mergeTutorSync(f: TutoredFamily, res: { cursor: number; changes: SyncRecord[]; childIds: string[]; familyLabel: string }, sent: string[]): TutoredFamily {
  const shared = new Set(res.childIds);
  const children: Record<string, Child> = {};
  for (const [id, c] of Object.entries(f.children)) if (shared.has(id)) children[id] = c;
  const eventIds = new Set(f.events.map((e) => e.id));
  const events = f.events.filter((e) => shared.has(e.childId));
  for (const r of res.changes) {
    if (r.kind === 'child') {
      const local = children[r.id] ? { kind: 'child' as const, id: r.id, updatedAt: children[r.id].updatedAt, data: children[r.id] } : undefined;
      if (pickWinner(local, r) === r) children[r.id] = r.data as Child;
    } else if (r.kind === 'event' && !eventIds.has(r.id)) {
      events.push(r.data as ProgressEvent);
      eventIds.add(r.id);
    }
  }
  // A child shared since the last sync: read the whole history again from the start.
  const newlyShared = res.childIds.some((id) => !f.childIds.includes(id));
  return {
    ...f,
    familyLabel: res.familyLabel,
    childIds: res.childIds,
    cursor: newlyShared && f.cursor !== 0 ? 0 : res.cursor,
    children,
    events,
    dirty: f.dirty.filter((k) => !sent.includes(k)),
    lastSyncAt: Date.now(),
  };
}

