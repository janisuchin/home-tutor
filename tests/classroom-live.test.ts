import { beforeEach, describe, expect, it } from 'vitest';
import { handleApi, type Env } from '../api/src/index';
import { createTestDb } from '../api/test/d1-sqlite';
import { createClassroomNamespace } from '../api/test/do-memory';
import { ask, cleanText, createRoom, hostView, isExpired, ROOM_TTL_MS, startPoll, studentView, vote, CODE_RE } from '../src/core/classroom-room';

let env: Env;
let ip = 0;
beforeEach(() => {
  env = { DB: createTestDb(), CLASSROOM: createClassroomNamespace() };
  ip++;
});
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await handleApi(
    new Request(`http://localhost/api${path}`, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': `10.2.0.${ip}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
  );
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}
const V1 = 'a1b2c3d4e5f6a7b8c9d0';
const V2 = 'f1e2d3c4b5a6f7e8d9c0';

describe('live classroom room logic', () => {
  it('one vote per device (a new vote replaces it), counts only for the host until the poll closes', () => {
    let r = startPoll(createRoom('ABCDEF', 'h', 0), 'p1', 'Best fruit?', ['Mango', 'Apple']);
    expect(r.ok).toBe(true);
    let room = (r as any).room;
    room = (vote(room, V1, 'p1', 0) as any).room;
    room = (vote(room, V1, 'p1', 1) as any).room; // changed mind
    room = (vote(room, V2, 'p1', 1) as any).room;
    expect(hostView(room).poll!.counts).toEqual([0, 2]);
    expect(hostView(room).participants).toBe(2);
    expect(studentView(room, V1).poll!.counts).toBeUndefined();
    expect(studentView(room, V1).poll!.myVote).toBe(1);
    expect(JSON.stringify(hostView(room))).not.toContain(V1); // no device ids for the teacher
  });
  it('rejects bad votes and questions on the server', () => {
    const room = (startPoll(createRoom('ABCDEF', 'h', 0), 'p1', 'Q?', ['A', 'B']) as any).room;
    expect(vote(room, 'bad id!', 'p1', 0)).toMatchObject({ ok: false, error: 'invalid_voter' });
    expect(vote(room, V1, 'old', 0)).toMatchObject({ ok: false, error: 'poll_changed' });
    expect(vote(room, V1, 'p1', 5)).toMatchObject({ ok: false, error: 'invalid_option' });
    expect(vote(room, V1, 'p1', 0.5)).toMatchObject({ ok: false, error: 'invalid_option' });
    expect(startPoll(room, 'p2', 'Q', ['only one'])).toMatchObject({ ok: false });
    expect(startPoll(room, 'p2', '', ['a', 'b'])).toMatchObject({ ok: false });
    expect(ask(room, V1, 'q', '   ', 0)).toMatchObject({ ok: false, error: 'invalid_question' });
    let r: any = { room };
    for (let i = 0; i < 5; i++) r = ask(r.room, V1, `q${i}`, `Question ${i}`, 0);
    expect(ask(r.room, V1, 'q9', 'One more', 0)).toMatchObject({ ok: false, error: 'too_many_questions' });
    expect(cleanText('a\u0000b‮  c' + 'x'.repeat(300), 10)).toBe('a b c' + 'xxxxx');
  });
  it('expires after 12 hours', () => {
    const room = createRoom('ABCDEF', 'h', 1000);
    expect(isExpired(room, 1000 + ROOM_TTL_MS - 1)).toBe(false);
    expect(isExpired(room, 1000 + ROOM_TTL_MS)).toBe(true);
  });
});

describe('live classroom API (Durable Object)', () => {
  it('teacher creates a room, students join with the code, vote and ask; the teacher sees live counts', async () => {
    const c = await call('POST', '/class/rooms');
    expect(c.status).toBe(201);
    expect(c.body.code).toMatch(CODE_RE);
    const host = { 'x-host-key': c.body.hostKey };
    const code = c.body.code as string;
    expect((await call('GET', `/class/rooms/${code}/host`)).status).toBe(403); // students are not hosts
    expect((await call('POST', `/class/rooms/${code}/poll`, { question: 'Hi?', options: ['a', 'b'] })).status).toBe(403);
    expect((await call('POST', `/class/rooms/${code}/poll`, { question: 'Which planet is biggest?', options: ['Mars', 'Jupiter', 'Earth'] }, host)).status).toBe(201);
    const s = await call('GET', `/class/rooms/${code.toLowerCase()}?voter=${V1}`);
    expect(s.body.poll.question).toBe('Which planet is biggest?');
    expect((await call('POST', `/class/rooms/${code}/vote`, { voter: V1, pollId: s.body.poll.id, option: 1 })).status).toBe(200);
    expect((await call('POST', `/class/rooms/${code}/vote`, { voter: V2, pollId: s.body.poll.id, option: 1 })).status).toBe(200);
    expect((await call('POST', `/class/rooms/${code}/questions`, { voter: V2, text: 'Why is Jupiter striped?' })).status).toBe(201);
    const h = await call('GET', `/class/rooms/${code}/host`, undefined, host);
    expect(h.body.poll.counts).toEqual([0, 2, 0]);
    expect(h.body.questions.map((q: any) => q.text)).toEqual(['Why is Jupiter striped?']);
    const qid = h.body.questions[0].id;
    expect((await call('POST', `/class/rooms/${code}/questions/${qid}`, { answered: true }, host)).status).toBe(200);
    expect((await call('POST', `/class/rooms/${code}/poll/close`, undefined, host)).status).toBe(200);
    const after = await call('GET', `/class/rooms/${code}?voter=${V2}`);
    expect(after.body.poll.counts).toEqual([0, 2, 0]);
    expect(after.body.myQuestions[0].answered).toBe(true);
    expect((await call('POST', `/class/rooms/${code}/vote`, { voter: V1, pollId: s.body.poll.id, option: 0 })).body.error).toBe('poll_closed');
    expect((await call('DELETE', `/class/rooms/${code}`, undefined, host)).status).toBe(200);
    expect((await call('GET', `/class/rooms/${code}`)).status).toBe(404);
  });
  it('unknown codes, bad codes and the internal init route are refused; creation is rate limited', async () => {
    expect((await call('GET', '/class/rooms/ZZZZZZ')).status).toBe(404);
    expect((await call('GET', '/class/rooms/IIIIII')).status).toBe(404);
    expect((await call('POST', '/class/rooms/ABCDEF/init', { code: 'ABCDEF', hostHash: 'x' })).status).toBe(404);
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await call('POST', '/class/rooms')).status);
    expect(codes.filter((s) => s === 201).length).toBe(20);
    expect(codes.at(-1)).toBe(429);
  });
  it('answers 503 when the Durable Object binding is missing', async () => {
    env = { DB: createTestDb() };
    expect((await call('POST', '/class/rooms')).status).toBe(503);
  });
});
