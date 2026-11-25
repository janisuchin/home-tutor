/**
 * Sync client: sends dirty records, receives everything newer than the cursor, merges
 * last-writer-wins (events by union). Runs at start, when the internet returns, a few seconds
 * after local changes, and every few minutes while the app is open.
 */
import { Platform } from 'react-native';
import { api, ApiError } from './api';
import { applyRemote, getState, onLocalChange, recordFor, setAccount, setSyncInfo } from './store';
import type { SyncRecord } from '../core/sync/merge';
import { buildPassport } from '../core/engine/passport';
import { getCatalogSync } from '../content/loader';

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export async function syncNow(): Promise<'ok' | 'offline' | 'signed-out' | 'error'> {
  const s = getState();
  if (!s.account) return 'signed-out';
  if (running) return 'ok';
  running = true;
  try {
    const dirty = [...s.sync.dirty];
    const changes = dirty.map((k) => recordFor(s, k)).filter((r): r is SyncRecord => !!r);
    const res = await api.sync(s.account.token, s.sync.cursor, changes);
    applyRemote(res.changes);
    const still = getState().sync.dirty.filter((k) => !dirty.includes(k));
    setSyncInfo({ cursor: res.cursor, dirty: still, lastSyncAt: Date.now(), lastError: undefined });
    await publishPassports();
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setAccount(undefined);
      return 'signed-out';
    }
    const offline = e instanceof ApiError && e.code === 'offline';
    setSyncInfo({ lastError: offline ? 'offline' : (e as Error).message });
    return offline ? 'offline' : 'error';
  } finally {
    running = false;
  }
}

/** Children with an active Progress Key get their passport snapshot refreshed after each sync. */
async function publishPassports() {
  const s = getState();
  const catalog = getCatalogSync();
  if (!s.account || !catalog) return;
  const now = Date.now();
  const childIds = new Set(
    Object.values(s.keys)
      .filter((k) => !k.revoked && (!k.expiresAt || k.expiresAt > now))
      .map((k) => k.childId),
  );
  for (const id of childIds) {
    const child = s.children[id];
    if (!child || child.deleted) continue;
    const snap = buildPassport(child, s.events, catalog, now);
    await api.publishPassport(s.account.token, id, snap).catch(() => {});
  }
}

export function startAutoSync() {
  const kick = (delay = 4000) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), delay);
  };
  onLocalChange(() => kick());
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => kick(500));
  }
  setInterval(() => void syncNow(), 3 * 60 * 1000);
  kick(1000);
}
