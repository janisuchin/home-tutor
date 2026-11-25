/**
 * Offline-first sync. Every synced thing is a record { kind, id, updatedAt, deleted?, data }.
 * - Mutable records (family, child, group, assignment, attendance) merge last-writer-wins on updatedAt;
 *   ties break on a stable comparison of the JSON so every device ends up identical.
 * - Progress events are immutable: they merge by union and never conflict.
 * The same functions run on the device and in the Worker.
 */
export type RecordKind = 'family' | 'child' | 'event' | 'group' | 'assignment' | 'attendance' | 'key';

export interface SyncRecord<T = unknown> {
  kind: RecordKind;
  id: string;
  updatedAt: number;
  deleted?: boolean;
  data: T;
}

export const IMMUTABLE_KINDS: RecordKind[] = ['event'];

/** Returns the record that should win. */
export function pickWinner<T>(a: SyncRecord<T> | undefined, b: SyncRecord<T>): SyncRecord<T> {
  if (!a) return b;
  if (IMMUTABLE_KINDS.includes(b.kind)) return a; // first write wins, events never change
  if (b.updatedAt > a.updatedAt) return b;
  if (b.updatedAt < a.updatedAt) return a;
  // Same timestamp: deletions win, then the larger JSON string (deterministic on every device).
  if (!!b.deleted !== !!a.deleted) return b.deleted ? b : a;
  return JSON.stringify(b.data) > JSON.stringify(a.data) ? b : a;
}

export function recordKey(r: { kind: string; id: string }): string {
  return `${r.kind}:${r.id}`;
}

/** Merge incoming records into a map keyed by kind:id. Returns the keys that changed. */
export function mergeInto(store: Map<string, SyncRecord>, incoming: SyncRecord[]): string[] {
  const changed: string[] = [];
  for (const r of incoming) {
    const k = recordKey(r);
    const cur = store.get(k);
    const win = pickWinner(cur, r);
    if (win !== cur) {
      store.set(k, win);
      changed.push(k);
    }
  }
  return changed;
}
