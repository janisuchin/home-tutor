/**
 * Live classroom (D-059). A Durable Object per room (named by its 6-character join code) keeps the
 * poll, the ballots and the class questions; every write goes through one object, so counts are
 * exact. Students poll it every 2 seconds. Rooms delete themselves 12 hours after creation.
 *
 * Routes (all under /api/class):
 *   POST /rooms                          create a room (rate limited per IP) -> { code, hostKey }
 *   GET  /rooms/:code?voter=             student view
 *   POST /rooms/:code/vote               { voter, pollId, option }
 *   POST /rooms/:code/questions          { voter, text }
 *   GET  /rooms/:code/host               teacher view            (x-host-key)
 *   POST /rooms/:code/poll               { question, options }   (x-host-key)
 *   POST /rooms/:code/poll/close                                 (x-host-key)
 *   POST /rooms/:code/questions/:id      { answered } | { remove: true } (x-host-key)
 *   DELETE /rooms/:code                  end the room now        (x-host-key)
 */
import { randomBytes, randomCode, randomId, sha256Hex } from '../../src/core/crypto';
import {
  ask,
  closePoll,
  CODE_RE,
  createRoom,
  hostView,
  isExpired,
  markAnswered,
  newRoomCode,
  removeQuestion,
  startPoll,
  studentView,
  vote,
  type Room,
  type RoomResult,
} from '../../src/core/classroom-room';
import { clientIp, err, HttpError, json, rateLimit, readJson, type Env } from './http';
import { safeEqual } from './auth';

/** The bits of the Durable Object API we use (so a small in-memory version can run in tests). */
export interface DOStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm?(at: number): Promise<void>;
}
export interface DOState {
  storage: DOStorage;
  blockConcurrencyWhile?<T>(fn: () => Promise<T>): Promise<T>;
}
export interface DONamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(req: Request): Promise<Response> };
}

const hostHash = (key: string) => sha256Hex(`home-tutor:class-host:${key}`);

export class ClassroomRoom {
  constructor(
    private state: DOState,
    _env?: unknown,
  ) {}

  private async load(now: number): Promise<Room | undefined> {
    const room = await this.state.storage.get<Room>('room');
    if (room && isExpired(room, now)) {
      await this.state.storage.deleteAll();
      return undefined;
    }
    return room;
  }

  async alarm() {
    await this.state.storage.deleteAll(); // the room's 12 hours are up
  }

  async fetch(req: Request): Promise<Response> {
    try {
      return await this.handle(req);
    } catch (e) {
      if (e instanceof HttpError) return err(e.status, e.code);
      return err(500, 'server_error');
    }
  }

  private async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname; // /init, /, /vote, /questions, /host, /poll, /poll/close, /questions/:id
    const m = req.method;
    const now = Date.now();
    if (path === '/init' && m === 'POST') {
      const body = await readJson(req);
      if (await this.state.storage.get('room')) {
        const existing = await this.load(now);
        if (existing) return err(409, 'code_taken');
      }
      const room = createRoom(body.code, body.hostHash, now);
      await this.state.storage.put('room', room);
      await this.state.storage.setAlarm?.(room.expiresAt);
      return json({ ok: true }, 201);
    }
    const room = await this.load(now);
    if (!room) return err(404, 'no_room');
    const isHost = () => {
      const k = req.headers.get('x-host-key') ?? '';
      return k.length >= 16 && safeEqual(hostHash(k), room.hostHash);
    };
    const save = async (r: RoomResult) => {
      if (!r.ok) return err(r.status, r.error);
      await this.state.storage.put('room', r.room);
      return null;
    };
    if (path === '/' && m === 'GET') return json(studentView(room, url.searchParams.get('voter') ?? undefined));
    if (path === '/vote' && m === 'POST') {
      const b = await readJson(req);
      return (await save(vote(room, b.voter, b.pollId, b.option))) ?? json({ ok: true });
    }
    if (path === '/questions' && m === 'POST') {
      const b = await readJson(req);
      return (await save(ask(room, b.voter, randomId(), b.text, now))) ?? json({ ok: true }, 201);
    }
    // Teacher only from here.
    if (!isHost()) return err(403, 'not_host');
    if (path === '/host' && m === 'GET') return json(hostView(room));
    if (path === '/poll' && m === 'POST') {
      const b = await readJson(req);
      return (await save(startPoll(room, randomId(), b.question, b.options))) ?? json({ ok: true }, 201);
    }
    if (path === '/poll/close' && m === 'POST') return (await save(closePoll(room))) ?? json({ ok: true });
    const q = path.match(/^\/questions\/([0-9a-f-]{36})$/);
    if (q && m === 'POST') {
      const b = await readJson(req);
      return (await save(b.remove === true ? removeQuestion(room, q[1]) : markAnswered(room, q[1], b.answered === true))) ?? json({ ok: true });
    }
    if (path === '/' && m === 'DELETE') {
      await this.state.storage.deleteAll();
      return json({ ok: true });
    }
    return err(404, 'not_found');
  }
}

/** Worker side: create rooms and forward room requests to the room's Durable Object. */
export async function handleClass(req: Request, env: Env, path: string): Promise<Response> {
  const ns = env.CLASSROOM;
  if (!ns) return err(503, 'live_class_unavailable');
  if (path === '/class/rooms' && req.method === 'POST') {
    if (!(await rateLimit(env.DB, `class-room:${clientIp(req)}`, 20, 3600))) throw new HttpError(429, 'rate_limited');
    for (let i = 0; i < 5; i++) {
      const code = newRoomCode(randomBytes);
      const hostKey = randomCode(24);
      const res = await ns.get(ns.idFromName(code)).fetch(
        new Request('https://room/init', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, hostHash: hostHash(hostKey) }) }),
      );
      if (res.status === 201) return json({ code, hostKey }, 201);
    }
    throw new HttpError(503, 'try_again');
  }
  const m = path.match(/^\/class\/rooms\/([A-Za-z0-9]{6})(\/.*)?$/);
  if (!m) return err(404, 'not_found');
  const code = m[1].toUpperCase();
  if (!CODE_RE.test(code)) return err(404, 'no_room');
  const sub = m[2] ?? '/';
  if (sub === '/init') return err(404, 'not_found');
  // Students: a light per-IP limit on writes (one classroom can share one IP, so it is generous).
  if (req.method === 'POST' && (sub === '/vote' || sub === '/questions')) {
    if (!(await rateLimit(env.DB, `class-write:${clientIp(req)}`, 600, 600))) throw new HttpError(429, 'rate_limited');
  }
  const url = new URL(req.url);
  const fwd = new Request(`https://room${sub}${url.search}`, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text() });
  return ns.get(ns.idFromName(code)).fetch(fwd);
}
