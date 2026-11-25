/** Client for live classroom rooms (D-059). No accounts and no names: a random id per device. */
import { apiBase } from './api';
import { randomBytes, toHex } from '../core/crypto';

const VOTER_KEY = 'home-tutor:voter';
let memoryVoter: string | undefined;

/** A random device id for voting (not linked to any account or person); kept on this device only. */
export function voterId(): string {
  try {
    const s = globalThis.localStorage?.getItem(VOTER_KEY);
    if (s) return s;
    const v = toHex(randomBytes(12));
    globalThis.localStorage?.setItem(VOTER_KEY, v);
    return v;
  } catch {
    memoryVoter ??= toHex(randomBytes(12));
    return memoryVoter;
  }
}

export class LiveError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init: RequestInit & { hostKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.hostKey) headers['x-host-key'] = init.hostKey;
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/class${path}`, { ...init, headers });
  } catch {
    throw new LiveError(0, 'offline');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new LiveError(res.status, (body as any).error ?? 'error');
  return body as T;
}

export interface StudentView {
  code: string;
  poll?: { id: string; question: string; options: string[]; open: boolean; myVote?: number; counts?: number[] };
  myQuestions: { id: string; text: string; answered: boolean }[];
}
export interface HostView {
  code: string;
  participants: number;
  poll?: { id: string; question: string; options: string[]; open: boolean; counts: number[]; voted: number };
  questions: { id: string; text: string; at: number; answered: boolean }[];
}

export const live = {
  create: () => call<{ code: string; hostKey: string }>('/rooms', { method: 'POST', body: '{}' }),
  view: (code: string) => call<StudentView>(`/rooms/${code}?voter=${voterId()}`),
  vote: (code: string, pollId: string, option: number) => call<{ ok: true }>(`/rooms/${code}/vote`, { method: 'POST', body: JSON.stringify({ voter: voterId(), pollId, option }) }),
  ask: (code: string, text: string) => call<{ ok: true }>(`/rooms/${code}/questions`, { method: 'POST', body: JSON.stringify({ voter: voterId(), text }) }),
  host: (code: string, hostKey: string) => call<HostView>(`/rooms/${code}/host`, { hostKey }),
  poll: (code: string, hostKey: string, question: string, options: string[]) => call<{ ok: true }>(`/rooms/${code}/poll`, { method: 'POST', hostKey, body: JSON.stringify({ question, options }) }),
  closePoll: (code: string, hostKey: string) => call<{ ok: true }>(`/rooms/${code}/poll/close`, { method: 'POST', hostKey, body: '{}' }),
  answered: (code: string, hostKey: string, id: string, answered: boolean) => call<{ ok: true }>(`/rooms/${code}/questions/${id}`, { method: 'POST', hostKey, body: JSON.stringify({ answered }) }),
  end: (code: string, hostKey: string) => call<{ ok: true }>(`/rooms/${code}`, { method: 'DELETE', hostKey }),
};

/** Calls fn now and every `ms` while mounted (the room is checked about every 2 seconds). */
export function every(ms: number, fn: () => void): () => void {
  fn();
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}
