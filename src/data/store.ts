/**
 * The device store: the whole family state lives here and is saved to device storage
 * (AsyncStorage: IndexedDB/localStorage on web). Works fully offline; the sync client sends
 * changed records to the cloud when the family is signed in and online.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Assignment,
  Child,
  Family,
  Group,
  ProgressEvent,
  ProgressKeyInfo,
} from '../core/model';
import type { RecordKind, SyncRecord } from '../core/sync/merge';
import { pickWinner, recordKey } from '../core/sync/merge';
import { randomId } from '../core/crypto';
import { addUsage, type UsageDay } from '../core/screen-time';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  open: boolean;
}

export interface ClassQuestion {
  id: string;
  text: string;
  by: string;
  votes: number;
  answered: boolean;
}

export interface AppState {
  version: 1;
  family?: Family;
  children: Record<string, Child>;
  events: ProgressEvent[];
  groups: Record<string, Group>;
  assignments: Record<string, Assignment>;
  keys: Record<string, ProgressKeyInfo>;
  account?: { token: string; accountId: string; signedInAt: number };
  sync: { cursor: number; dirty: string[]; lastSyncAt?: number; lastError?: string; deletedChildren?: string[] };
  usage: Record<string, UsageDay>;
  activeChildId?: string;
  /** Attendance: groupId -> day -> childIds present. */
  attendance: Record<string, Record<string, string[]>>;
  polls: Poll[];
  questions: ClassQuestion[];
}

const STORAGE_KEY = 'home-tutor:v1';

export const emptyState = (): AppState => ({
  version: 1,
  children: {},
  events: [],
  groups: {},
  assignments: {},
  keys: {},
  sync: { cursor: 0, dirty: [] },
  usage: {},
  attendance: {},
  polls: [],
  questions: [],
});

let state: AppState = emptyState();
let loaded = false;
/** Parent/tutor area unlock lives in memory only, so a reload always locks it again. */
let parentUnlockedUntil = 0;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const changeHooks = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, 250);
}

export function getState(): AppState {
  return state;
}

export function isLoaded() {
  return loaded;
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    state = emptyState();
  }
  loaded = true;
  emit();
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function onLocalChange(fn: () => void) {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

/** Replace state (used by tests and by import). */
export function setState(next: AppState, opts: { save?: boolean } = {}) {
  state = next;
  if (opts.save !== false) scheduleSave();
  emit();
}

function update(fn: (s: AppState) => AppState, dirty: string[] = []) {
  const next = fn(state);
  if (dirty.length) {
    const set = new Set(next.sync.dirty);
    for (const d of dirty) set.add(d);
    next.sync = { ...next.sync, dirty: [...set] };
  }
  state = next;
  scheduleSave();
  emit();
  if (dirty.length) for (const h of changeHooks) h();
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

// ---------- parent lock ----------
export function unlockParent(minutes = 15) {
  parentUnlockedUntil = Date.now() + minutes * 60 * 1000;
  emit();
}
export function lockParent() {
  parentUnlockedUntil = 0;
  emit();
}
export function isParentUnlocked() {
  return Date.now() < parentUnlockedUntil;
}
export function useParentUnlocked() {
  return useSyncExternalStore(subscribe, isParentUnlocked, isParentUnlocked);
}

// ---------- mutations ----------
export function saveFamily(family: Family) {
  update((s) => ({ ...s, family: { ...family, updatedAt: Date.now() } }), [recordKey({ kind: 'family', id: family.id })]);
}

export function saveChild(child: Child) {
  const c = { ...child, updatedAt: Date.now() };
  update((s) => ({ ...s, children: { ...s.children, [c.id]: c } }), [recordKey({ kind: 'child', id: c.id })]);
}

export function deleteChild(id: string) {
  const c = state.children[id];
  if (!c) return;
  update(
    (s) => {
      const children = { ...s.children, [id]: { ...c, deleted: true, updatedAt: Date.now() } };
      return {
        ...s,
        children,
        events: s.events.filter((e) => e.childId !== id),
        activeChildId: s.activeChildId === id ? undefined : s.activeChildId,
        sync: { ...s.sync, deletedChildren: [...(s.sync.deletedChildren ?? []), id] },
      };
    },
    [recordKey({ kind: 'child', id })],
  );
}

export function setActiveChild(id: string | undefined) {
  update((s) => ({ ...s, activeChildId: id }));
}

export function addEvent(e: Omit<ProgressEvent, 'id' | 'at'> & { at?: number }) {
  const ev: ProgressEvent = { id: randomId(), at: Date.now(), ...e };
  update((s) => ({ ...s, events: [...s.events, ev] }), [recordKey({ kind: 'event', id: ev.id })]);
  return ev;
}

export function saveGroup(g: Group) {
  const ng = { ...g, updatedAt: Date.now() };
  update((s) => ({ ...s, groups: { ...s.groups, [g.id]: ng } }), [recordKey({ kind: 'group', id: g.id })]);
}

export function saveAssignment(a: Assignment) {
  const na = { ...a, updatedAt: Date.now() };
  update((s) => ({ ...s, assignments: { ...s.assignments, [a.id]: na } }), [recordKey({ kind: 'assignment', id: a.id })]);
}

export function saveKey(k: ProgressKeyInfo) {
  update((s) => ({ ...s, keys: { ...s.keys, [k.id]: k } }));
}

export function setAttendance(groupId: string, day: string, childIds: string[]) {
  update((s) => ({ ...s, attendance: { ...s.attendance, [groupId]: { ...(s.attendance[groupId] ?? {}), [day]: childIds } } }));
}

export function setPolls(polls: Poll[]) {
  update((s) => ({ ...s, polls }));
}
export function setQuestions(questions: ClassQuestion[]) {
  update((s) => ({ ...s, questions }));
}

export function trackUsage(childId: string, seconds: number) {
  update((s) => ({ ...s, usage: { ...s.usage, [childId]: addUsage(s.usage[childId], seconds) } }));
}

export function grantExtraMinutes(childId: string, minutes: number) {
  update((s) => {
    const u = addUsage(s.usage[childId], 0);
    return { ...s, usage: { ...s.usage, [childId]: { ...u, extraMinutes: u.extraMinutes + minutes } } };
  });
}

export function setAccount(account: AppState['account']) {
  update((s) => ({ ...s, account, sync: account ? s.sync : { cursor: 0, dirty: allRecordKeys(s) } }));
}

export function setSyncInfo(info: Partial<AppState['sync']>) {
  update((s) => ({ ...s, sync: { ...s.sync, ...info } }));
}

/** Wipe everything on this device (delete-my-data). */
export async function wipeDevice() {
  state = emptyState();
  lockParent();
  await AsyncStorage.removeItem(STORAGE_KEY);
  emit();
}

// ---------- sync helpers ----------
export function allRecordKeys(s: AppState): string[] {
  const keys: string[] = [];
  if (s.family) keys.push(recordKey({ kind: 'family', id: s.family.id }));
  for (const id of Object.keys(s.children)) keys.push(recordKey({ kind: 'child', id }));
  for (const e of s.events) keys.push(recordKey({ kind: 'event', id: e.id }));
  for (const id of Object.keys(s.groups)) keys.push(recordKey({ kind: 'group', id }));
  for (const id of Object.keys(s.assignments)) keys.push(recordKey({ kind: 'assignment', id }));
  return keys;
}

export function recordFor(s: AppState, key: string): SyncRecord | undefined {
  const [kind, id] = key.split(/:(.+)/) as [RecordKind, string];
  switch (kind) {
    case 'family':
      return s.family && s.family.id === id
        ? { kind, id, updatedAt: s.family.updatedAt, data: s.family }
        : undefined;
    case 'child': {
      const c = s.children[id];
      return c ? { kind, id, updatedAt: c.updatedAt, deleted: c.deleted, data: c } : undefined;
    }
    case 'event': {
      const e = s.events.find((x) => x.id === id);
      return e ? { kind, id, updatedAt: e.at, data: e } : undefined;
    }
    case 'group': {
      const g = s.groups[id];
      return g ? { kind, id, updatedAt: g.updatedAt, deleted: g.deleted, data: g } : undefined;
    }
    case 'assignment': {
      const a = s.assignments[id];
      return a ? { kind, id, updatedAt: a.updatedAt, deleted: a.deleted, data: a } : undefined;
    }
  }
  return undefined;
}

/** Apply records that came from the server, last-writer-wins, without marking them dirty. */
export function applyRemote(records: SyncRecord[]) {
  if (!records.length) return;
  const s = { ...state, children: { ...state.children }, groups: { ...state.groups }, assignments: { ...state.assignments } };
  const eventIds = new Set(s.events.map((e) => e.id));
  const newEvents: ProgressEvent[] = [];
  for (const r of records) {
    const local = recordFor(s, recordKey(r));
    const win = pickWinner(local, r);
    if (win === local) continue;
    switch (r.kind) {
      case 'family':
        s.family = r.data as Family;
        break;
      case 'child':
        s.children[r.id] = { ...(r.data as Child), deleted: r.deleted };
        break;
      case 'event':
        if (!eventIds.has(r.id)) {
          newEvents.push(r.data as ProgressEvent);
          eventIds.add(r.id);
        }
        break;
      case 'group':
        s.groups[r.id] = { ...(r.data as Group), deleted: r.deleted };
        break;
      case 'assignment':
        s.assignments[r.id] = { ...(r.data as Assignment), deleted: r.deleted };
        break;
    }
  }
  s.events = [...s.events, ...newEvents];
  state = s;
  scheduleSave();
  emit();
}

export function liveChildren(s: AppState): Child[] {
  return Object.values(s.children).filter((c) => !c.deleted);
}
