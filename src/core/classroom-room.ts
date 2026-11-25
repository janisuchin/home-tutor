/**
 * Live classroom room (D-059): students vote in polls and send class questions from their own
 * devices with a short join code. Pure state functions, used by the Durable Object on the server,
 * the local test server and the unit tests. No personal data: students are random device ids,
 * questions are anonymous text, and a room deletes itself after 12 hours.
 */
export const ROOM_TTL_MS = 12 * 3600_000;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;
export const VOTER_RE = /^[a-z0-9]{16,40}$/;
export const LIMITS = { question: 200, pollQuestion: 160, option: 60, options: 6, questions: 100, perVoterQuestions: 5, voters: 300 };

export interface RoomPoll {
  id: string;
  question: string;
  options: string[];
  open: boolean;
  /** voter id -> option index (one vote per device; a new vote replaces the old one). */
  ballots: Record<string, number>;
}
export interface RoomQuestion {
  id: string;
  text: string;
  at: number;
  answered: boolean;
  voter: string;
}
export interface Room {
  code: string;
  hostHash: string;
  createdAt: number;
  expiresAt: number;
  poll?: RoomPoll;
  questions: RoomQuestion[];
  voters: string[];
}

export type RoomResult<T = Room> = { ok: true; room: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string) => ({ ok: false as const, status, error });

/** Removes control characters and squeezes spaces; returns '' for nothing left. */
export function cleanText(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function createRoom(code: string, hostHash: string, now: number): Room {
  return { code, hostHash, createdAt: now, expiresAt: now + ROOM_TTL_MS, questions: [], voters: [] };
}

export function isExpired(room: Room, now: number) {
  return now >= room.expiresAt;
}

function seeVoter(room: Room, voter: string): RoomResult {
  if (!VOTER_RE.test(voter)) return fail(400, 'invalid_voter');
  if (!room.voters.includes(voter)) {
    if (room.voters.length >= LIMITS.voters) return fail(429, 'room_full');
    room.voters = [...room.voters, voter];
  }
  return { ok: true, room };
}

export function startPoll(room: Room, id: string, question: unknown, options: unknown): RoomResult {
  const q = cleanText(question, LIMITS.pollQuestion);
  if (!q) return fail(400, 'invalid_poll');
  if (!Array.isArray(options)) return fail(400, 'invalid_poll');
  const opts = options.map((o) => cleanText(o, LIMITS.option)).filter(Boolean);
  if (opts.length < 2 || opts.length > LIMITS.options || opts.length !== options.length) return fail(400, 'invalid_poll');
  return { ok: true, room: { ...room, poll: { id, question: q, options: opts, open: true, ballots: {} } } };
}

export function closePoll(room: Room): RoomResult {
  if (!room.poll) return fail(404, 'no_poll');
  return { ok: true, room: { ...room, poll: { ...room.poll, open: false } } };
}

export function vote(room: Room, voter: unknown, pollId: unknown, option: unknown): RoomResult {
  const seen = seeVoter({ ...room }, String(voter ?? ''));
  if (!seen.ok) return seen;
  const r = seen.room;
  if (!r.poll || r.poll.id !== pollId) return fail(409, 'poll_changed');
  if (!r.poll.open) return fail(409, 'poll_closed');
  if (!Number.isInteger(option) || (option as number) < 0 || (option as number) >= r.poll.options.length) return fail(400, 'invalid_option');
  return { ok: true, room: { ...r, poll: { ...r.poll, ballots: { ...r.poll.ballots, [voter as string]: option as number } } } };
}

export function ask(room: Room, voter: unknown, id: string, text: unknown, now: number): RoomResult {
  const seen = seeVoter({ ...room }, String(voter ?? ''));
  if (!seen.ok) return seen;
  const r = seen.room;
  const t = cleanText(text, LIMITS.question);
  if (!t) return fail(400, 'invalid_question');
  if (r.questions.length >= LIMITS.questions) return fail(429, 'too_many_questions');
  if (r.questions.filter((q) => q.voter === voter).length >= LIMITS.perVoterQuestions) return fail(429, 'too_many_questions');
  return { ok: true, room: { ...r, questions: [...r.questions, { id, text: t, at: now, answered: false, voter: voter as string }] } };
}

export function markAnswered(room: Room, questionId: unknown, answered: boolean): RoomResult {
  if (!room.questions.some((q) => q.id === questionId)) return fail(404, 'no_question');
  return { ok: true, room: { ...room, questions: room.questions.map((q) => (q.id === questionId ? { ...q, answered } : q)) } };
}

export function removeQuestion(room: Room, questionId: unknown): RoomResult {
  if (!room.questions.some((q) => q.id === questionId)) return fail(404, 'no_question');
  return { ok: true, room: { ...room, questions: room.questions.filter((q) => q.id !== questionId) } };
}

export function counts(poll: RoomPoll): number[] {
  const c = poll.options.map(() => 0);
  for (const v of Object.values(poll.ballots)) c[v]++;
  return c;
}

/** What a student device sees: the open poll (no counts until it closes), and whether it voted. */
export function studentView(room: Room, voter?: string) {
  const p = room.poll;
  return {
    code: room.code,
    expiresAt: room.expiresAt,
    poll: p ? { id: p.id, question: p.question, options: p.options, open: p.open, myVote: voter ? p.ballots[voter] : undefined, counts: p.open ? undefined : counts(p) } : undefined,
    myQuestions: voter ? room.questions.filter((q) => q.voter === voter).map((q) => ({ id: q.id, text: q.text, answered: q.answered })) : [],
  };
}

/** What the teacher's screen sees: live counts and every question (never the voter ids). */
export function hostView(room: Room) {
  const p = room.poll;
  return {
    code: room.code,
    expiresAt: room.expiresAt,
    participants: room.voters.length,
    poll: p ? { id: p.id, question: p.question, options: p.options, open: p.open, counts: counts(p), voted: Object.keys(p.ballots).length } : undefined,
    questions: room.questions.map((q) => ({ id: q.id, text: q.text, at: q.at, answered: q.answered })),
  };
}

export function newRoomCode(random: (n: number) => Uint8Array): string {
  const b = random(6);
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}
