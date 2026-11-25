/**
 * The tutor's side of tutor accounts. Families that invited this signed-in account as a tutor are
 * kept apart from the device's own family (separate storage key), so a tutor's own children, if
 * any, never mix with the children they tutor. Each link syncs on its own; the server only ever
 * returns the shared children and their progress, and only accepts new progress from the tutor.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Child, ProgressEvent } from '../core/model';
import type { SyncRecord } from '../core/sync/merge';
export type { TutoredFamily } from '../core/sync/tutor-merge';
import { mergeTutorSync, type TutoredFamily } from '../core/sync/tutor-merge';
import { randomId } from '../core/crypto';
import { api, ApiError } from './api';
import { getState } from './store';

export interface TutoringState {
  accountId?: string;
  families: Record<string, TutoredFamily>;
}

const KEY = 'home-tutor:tutoring:v1';
let state: TutoringState = { families: {} };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}
function set(next: TutoringState) {
  state = next;
  save();
  emit();
}

export async function loadTutoring() {
  if (loaded) return state;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { families: {}, ...JSON.parse(raw) };
  } catch {
    state = { families: {} };
  }
  loaded = true;
  emit();
  return state;
}

export function getTutoring() {
  return state;
}

export function useTutoring<T>(select: (s: TutoringState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
    () => select(state),
  );
}

export async function clearTutoring() {
  state = { families: {} };
  await AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

function recordFor(f: TutoredFamily, key: string): SyncRecord | undefined {
  const [kind, id] = key.split(/:(.+)/);
  if (kind === 'child' && f.children[id]) return { kind: 'child', id, updatedAt: f.children[id].updatedAt, data: f.children[id] };
  if (kind === 'event') {
    const e = f.events.find((x) => x.id === id);
    if (e) return { kind: 'event', id, updatedAt: e.at, data: e };
  }
  return undefined;
}

let running = false;
/** Accepts the code, then syncs every tutored family. */
export async function acceptTutorInvite(code: string) {
  const account = getState().account;
  if (!account) throw new ApiError(401, 'unauthorized');
  const { link } = await api.acceptInvite(account.token, code);
  const f: TutoredFamily = { id: link.id, familyLabel: link.familyLabel, childIds: [], cursor: 0, children: {}, events: [], dirty: [] };
  set({ ...state, accountId: account.accountId, families: { ...state.families, [link.id]: f } });
  await syncTutoring();
  return link;
}

/**
 * Syncs every family this account tutors. Families whose link was removed by the parent (or that
 * belong to another account that used this device) are forgotten on this device.
 */
export async function syncTutoring(): Promise<'ok' | 'signed-out' | 'offline' | 'error'> {
  const account = getState().account;
  if (!account) return 'signed-out';
  if (running) return 'ok';
  running = true;
  try {
    await loadTutoring();
    if (state.accountId && state.accountId !== account.accountId) state = { families: {} };
    const { links } = await api.tutorLinks(account.token);
    const families: Record<string, TutoredFamily> = {};
    for (const l of links) families[l.id] = state.families[l.id] ?? { id: l.id, familyLabel: l.familyLabel, childIds: [], cursor: 0, children: {}, events: [], dirty: [] };
    for (const id of Object.keys(families)) {
      let f = families[id];
      for (let round = 0; round < 20; round++) {
        const sent = [...f.dirty];
        const changes = sent.map((k) => recordFor(f, k)).filter((r): r is SyncRecord => !!r);
        try {
          const res = await api.tutorSync(account.token, id, f.cursor, changes);
          const before = f.cursor;
          f = mergeTutorSync(f, res, sent);
          if (!res.more && !(f.cursor === 0 && before !== 0)) break;
        } catch (e) {
          if (e instanceof ApiError && e.status === 403) {
            delete families[id];
            break;
          }
          throw e;
        }
      }
      if (families[id]) families[id] = f;
    }
    set({ accountId: account.accountId, families });
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError && e.code === 'offline') return 'offline';
    if (e instanceof ApiError && e.status === 401) return 'signed-out';
    return 'error';
  } finally {
    running = false;
  }
}

function updateFamily(linkId: string, fn: (f: TutoredFamily) => TutoredFamily) {
  const f = state.families[linkId];
  if (!f) return;
  set({ ...state, families: { ...state.families, [linkId]: fn(f) } });
}

/** Records progress as the tutor (for example a session's minutes, or an item done together). */
export function addTutorEvent(linkId: string, e: Omit<ProgressEvent, 'id' | 'at' | 'by'>) {
  const ev: ProgressEvent = { id: randomId(), at: Date.now(), by: 'tutor', ...e };
  updateFamily(linkId, (f) => ({ ...f, events: [...f.events, ev], dirty: [...new Set([...f.dirty, `event:${ev.id}`])] }));
  void syncTutoring();
  return ev;
}

/** Tutors may change a few learning fields; the server ignores every other field. */
export function updateTutoredChild(linkId: string, childId: string, patch: Partial<Pick<Child, 'levelOverrides' | 'interests' | 'goals' | 'strengths' | 'growingAreas' | 'learningStyles'>>) {
  updateFamily(linkId, (f) => {
    const c = f.children[childId];
    if (!c) return f;
    return { ...f, children: { ...f.children, [childId]: { ...c, ...patch, updatedAt: Date.now() } }, dirty: [...new Set([...f.dirty, `child:${childId}`])] };
  });
  void syncTutoring();
}
