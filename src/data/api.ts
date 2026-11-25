/**
 * Talks to the Home Tutor API (Cloudflare Worker + D1). On the web the API is same-origin (/api);
 * native builds use the deployed URL from app.json extra.apiBase.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { SyncRecord } from '../core/sync/merge';
import type { PassportSnapshot } from '../core/engine/passport';

const DEFAULT_REMOTE = 'https://home-tutor.german-journey.workers.dev';

export function apiBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return '';
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string };
  return extra.apiBase ?? DEFAULT_REMOTE;
}

export function publicBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return DEFAULT_REMOTE;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api${path}`, { ...init, headers: { ...headers, ...(init.headers as any) } });
  } catch {
    throw new ApiError(0, 'offline');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as any).error ?? 'error');
  return body as T;
}

export interface AuthResult {
  token: string;
  accountId: string;
  recoveryKey?: string;
}

export interface TutorInfo {
  id: string;
  label: string;
  familyLabel: string;
  childIds: string[];
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
}
export interface TutorLink {
  id: string;
  familyLabel: string;
  childIds: string[];
}
export interface TutorSyncResult {
  cursor: number;
  changes: SyncRecord[];
  more: boolean;
  childIds: string[];
  familyLabel: string;
}

export const api = {
  signup: (email: string, password: string, consent: boolean) =>
    call<AuthResult>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, consent }) }),
  login: (email: string, password: string) =>
    call<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  recover: (email: string, recoveryKey: string, newPassword: string) =>
    call<AuthResult>('/auth/recover', { method: 'POST', body: JSON.stringify({ email, recoveryKey, newPassword }) }),
  logout: (token: string) => call<{ ok: true }>('/auth/logout', { method: 'POST', token }),
  sync: (token: string, cursor: number, changes: SyncRecord[]) =>
    call<{ cursor: number; changes: SyncRecord[] }>('/sync', { method: 'POST', token, body: JSON.stringify({ cursor, changes }) }),
  exportAll: (token: string) => call<unknown>('/account/export', { token }),
  deleteAccount: (token: string) => call<{ ok: true }>('/account', { method: 'DELETE', token }),
  createKey: (token: string, childId: string, code: string, expiresAt?: number) =>
    call<{ id: string }>('/keys', { method: 'POST', token, body: JSON.stringify({ childId, code, expiresAt }) }),
  revokeKey: (token: string, id: string) => call<{ ok: true }>(`/keys/${id}`, { method: 'DELETE', token }),
  publishPassport: (token: string, childId: string, snapshot: PassportSnapshot) =>
    call<{ ok: true }>(`/passport-snapshot/${childId}`, { method: 'PUT', token, body: JSON.stringify(snapshot) }),
  readPassport: (code: string) => call<{ snapshot: PassportSnapshot; expiresAt?: number }>(`/passport/${encodeURIComponent(code)}`),
  // Tutor accounts: the parent side.
  inviteTutor: (token: string, childIds: string[], label: string, familyLabel: string) =>
    call<{ id: string; code: string; expiresAt: number }>('/tutors', { method: 'POST', token, body: JSON.stringify({ childIds, label, familyLabel }) }),
  listTutors: (token: string) => call<{ tutors: TutorInfo[] }>('/tutors', { token }),
  updateTutor: (token: string, id: string, childIds: string[]) => call<{ ok: true }>(`/tutors/${id}`, { method: 'PUT', token, body: JSON.stringify({ childIds }) }),
  removeTutor: (token: string, id: string) => call<{ ok: true }>(`/tutors/${id}`, { method: 'DELETE', token }),
  // Tutor accounts: the tutor side.
  acceptInvite: (token: string, code: string) => call<{ link: TutorLink }>('/tutor/accept', { method: 'POST', token, body: JSON.stringify({ code }) }),
  tutorLinks: (token: string) => call<{ links: TutorLink[] }>('/tutor/links', { token }),
  tutorSync: (token: string, linkId: string, cursor: number, changes: SyncRecord[]) =>
    call<TutorSyncResult>(`/tutor/links/${linkId}/sync`, { method: 'POST', token, body: JSON.stringify({ cursor, changes }) }),
  aiTutor: (token: string, question: string) =>
    call<{ enabled: false }>('/ai-tutor', { method: 'POST', token, body: JSON.stringify({ question }) }),
};
