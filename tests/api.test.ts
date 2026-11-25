import { beforeEach, describe, expect, it } from 'vitest';
import { handleApi, rateLimit, type Env } from '../api/src/index';
import { createTestDb } from '../api/test/d1-sqlite';
import { randomCode } from '../src/core/crypto';

let env: Env;
let ip = 0;
beforeEach(() => {
  env = { DB: createTestDb(), PASSWORD_ITERATIONS: '2000' };
  ip++;
});

async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await handleApi(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': `10.0.0.${ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

const EMAIL = 'parent@example.org';
const PW = 'a long family password';
async function signup(email = EMAIL) {
  const r = await call('POST', '/auth/signup', { email, password: PW, consent: true });
  expect(r.status).toBe(201);
  return r.body as { token: string; accountId: string; recoveryKey: string };
}
const child = (id: string, updatedAt: number, name = 'Asha', deleted = false) => ({ kind: 'child', id, updatedAt, deleted, data: { id, name } });
const event = (id: string, childId: string) => ({ kind: 'event', id, updatedAt: 1000, data: { id, childId, type: 'completed' } });

describe('auth', () => {
  it('signs up with consent and returns a one-time recovery key', async () => {
    const s = await signup();
    expect(s.token).toMatch(/^[0-9a-f]{64}$/);
    expect(s.recoveryKey).toMatch(/^[A-HJ-NP-Z2-9]{20}$/);
    expect((await call('POST', '/auth/signup', { email: EMAIL, password: PW, consent: false })).body.error).toBe('consent_required');
    expect((await call('POST', '/auth/signup', { email: 'Parent@Example.org ', password: PW, consent: true })).status).toBe(409);
  });
  it('never stores the email address in plain text', async () => {
    await signup();
    const row = await env.DB.prepare('SELECT * FROM accounts').first<any>();
    expect(JSON.stringify(row)).not.toContain('example.org');
    expect(row.pw_hash).not.toContain(PW);
  });
  it('rejects weak passwords and wrong passwords', async () => {
    expect((await call('POST', '/auth/signup', { email: 'x@y.zz', password: 'short', consent: true })).body.error).toBe('invalid_password');
    await signup();
    expect((await call('POST', '/auth/login', { email: EMAIL, password: 'wrong password!!' })).status).toBe(401);
    const ok = await call('POST', '/auth/login', { email: EMAIL.toUpperCase(), password: PW });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
  });
  it('rate limits repeated login attempts', async () => {
    await signup();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await call('POST', '/auth/login', { email: EMAIL, password: 'wrong password!!' })).status);
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes[5]).toBe(429);
  });
  it('fixed-window limiter resets in the next window', async () => {
    const t = 1_000_000_000_000;
    expect(await rateLimit(env.DB, 'k', 1, 60, t)).toBe(true);
    expect(await rateLimit(env.DB, 'k', 1, 60, t + 1)).toBe(false);
    expect(await rateLimit(env.DB, 'k', 1, 60, t + 61_000)).toBe(true);
  });
  it('recovers with the recovery key, rotates it and signs out other sessions', async () => {
    const s = await signup();
    expect((await call('POST', '/auth/recover', { email: EMAIL, recoveryKey: 'WRONGWRONGWRONGWRONG', newPassword: 'a brand new password' })).status).toBe(401);
    const r = await call('POST', '/auth/recover', { email: EMAIL, recoveryKey: s.recoveryKey.toLowerCase(), newPassword: 'a brand new password' });
    expect(r.status).toBe(200);
    expect(r.body.recoveryKey).not.toBe(s.recoveryKey);
    expect((await call('POST', '/sync', { cursor: 0, changes: [] }, s.token)).status).toBe(401);
    expect((await call('POST', '/auth/login', { email: EMAIL, password: 'a brand new password' })).status).toBe(200);
    expect((await call('POST', '/auth/recover', { email: EMAIL, recoveryKey: s.recoveryKey, newPassword: 'another new password' })).status).toBe(401);
  });
  it('requires a valid session for private routes', async () => {
    expect((await call('POST', '/sync', { cursor: 0, changes: [] })).status).toBe(401);
    expect((await call('POST', '/sync', { cursor: 0, changes: [] }, 'f'.repeat(64))).status).toBe(401);
    const s = await signup();
    await call('POST', '/auth/logout', {}, s.token);
    expect((await call('POST', '/sync', { cursor: 0, changes: [] }, s.token)).status).toBe(401);
  });
});

describe('sync', () => {
  it('round-trips records between two devices of one account', async () => {
    const s = await signup();
    const a = await call('POST', '/sync', { cursor: 0, changes: [child('c1', 100), event('e1', 'c1')] }, s.token);
    expect(a.status).toBe(200);
    const b = await call('POST', '/sync', { cursor: 0, changes: [] }, s.token);
    expect(b.body.changes.map((r: any) => r.id).sort()).toEqual(['c1', 'e1']);
    const again = await call('POST', '/sync', { cursor: b.body.cursor, changes: [] }, s.token);
    expect(again.body.changes).toEqual([]);
  });
  it('resolves conflicts last-writer-wins and ignores stale writes', async () => {
    const s = await signup();
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 200, 'tablet')] }, s.token);
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 100, 'old phone')] }, s.token);
    const r = await call('POST', '/sync', { cursor: 0, changes: [] }, s.token);
    expect(r.body.changes.find((x: any) => x.id === 'c1').data.name).toBe('tablet');
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 300, 'newest')] }, s.token);
    const r2 = await call('POST', '/sync', { cursor: r.body.cursor, changes: [] }, s.token);
    expect(r2.body.changes[0].data.name).toBe('newest');
  });
  it('keeps events immutable (first write wins)', async () => {
    const s = await signup();
    await call('POST', '/sync', { cursor: 0, changes: [event('e1', 'c1')] }, s.token);
    await call('POST', '/sync', { cursor: 0, changes: [{ ...event('e1', 'c1'), updatedAt: 5000, data: { id: 'e1', childId: 'c1', type: 'hacked' } }] }, s.token);
    const r = await call('POST', '/sync', { cursor: 0, changes: [] }, s.token);
    expect(r.body.changes.find((x: any) => x.id === 'e1').data.type).toBe('completed');
  });
  it('isolates accounts from each other', async () => {
    const a = await signup('a@example.org');
    const b = await signup('b@example.org');
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 100, 'A child')] }, a.token);
    const r = await call('POST', '/sync', { cursor: 0, changes: [] }, b.token);
    expect(r.body.changes).toEqual([]);
  });
  it('rejects invalid records and unknown kinds', async () => {
    const s = await signup();
    const r = await call('POST', '/sync', { cursor: 0, changes: [{ kind: 'account', id: 'x', updatedAt: 1, data: {} }, { kind: 'child', id: '', updatedAt: 1, data: {} }] }, s.token);
    expect(r.body.rejected).toBe(2);
  });
  it('deleting a child deletes their events, snapshot and keys', async () => {
    const s = await signup();
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 100), event('e1', 'c1'), event('e2', 'c1')] }, s.token);
    const code = randomCode(12);
    await call('POST', '/keys', { childId: 'c1', code }, s.token);
    await call('PUT', '/passport-snapshot/c1', { version: 1, name: 'Asha' }, s.token);
    expect((await call('GET', `/passport/${code}`)).status).toBe(200);
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 200, 'Asha', true)] }, s.token);
    const r = await call('POST', '/sync', { cursor: 0, changes: [] }, s.token);
    expect(r.body.changes.filter((x: any) => x.kind === 'event')).toEqual([]);
    expect((await call('GET', `/passport/${code}`)).status).toBe(404);
  });
});

describe('Progress Key', () => {
  async function setup() {
    const s = await signup();
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 100)] }, s.token);
    await call('PUT', '/passport-snapshot/c1', { version: 1, name: 'Asha', competencies: [] }, s.token);
    return s;
  }
  it('opens a read-only passport with the code, in any formatting', async () => {
    const s = await setup();
    const code = randomCode(12);
    const k = await call('POST', '/keys', { childId: 'c1', code }, s.token);
    expect(k.status).toBe(201);
    const r = await call('GET', `/passport/${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8).toLowerCase()}`);
    expect(r.status).toBe(200);
    expect(r.body.snapshot.name).toBe('Asha');
    expect((await call('GET', `/passport/${randomCode(12)}`)).status).toBe(404);
  });
  it('stops working after revocation', async () => {
    const s = await setup();
    const code = randomCode(12);
    const k = await call('POST', '/keys', { childId: 'c1', code }, s.token);
    expect((await call('DELETE', `/keys/${k.body.id}`, undefined, s.token)).status).toBe(200);
    expect((await call('GET', `/passport/${code}`)).status).toBe(404);
  });
  it('only the owner can revoke', async () => {
    const s = await setup();
    const other = await signup('other@example.org');
    const code = randomCode(12);
    const k = await call('POST', '/keys', { childId: 'c1', code }, s.token);
    await call('DELETE', `/keys/${k.body.id}`, undefined, other.token);
    expect((await call('GET', `/passport/${code}`)).status).toBe(200);
  });
  it('stops working after expiry', async () => {
    const s = await setup();
    const code = randomCode(12);
    await call('POST', '/keys', { childId: 'c1', code, expiresAt: Date.now() + 50 }, s.token);
    expect((await call('GET', `/passport/${code}`)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 80));
    expect((await call('GET', `/passport/${code}`)).status).toBe(404);
  });
  it('cannot create a key for a child that is not in the account', async () => {
    const s = await setup();
    expect((await call('POST', '/keys', { childId: 'nobody', code: randomCode(12) }, s.token)).status).toBe(404);
    expect((await call('POST', '/keys', { childId: 'c1', code: 'short' }, s.token)).status).toBe(400);
  });
  it('stores only a hash of the code', async () => {
    const s = await setup();
    const code = randomCode(12);
    await call('POST', '/keys', { childId: 'c1', code }, s.token);
    const row = await env.DB.prepare('SELECT * FROM progress_keys').first<any>();
    expect(JSON.stringify(row)).not.toContain(code);
  });
});

describe('account data rights', () => {
  it('exports everything and deletes everything', async () => {
    const s = await signup();
    await call('POST', '/sync', { cursor: 0, changes: [child('c1', 100), event('e1', 'c1')] }, s.token);
    const ex = await call('GET', '/account/export', undefined, s.token);
    expect(ex.body.records.length).toBe(2);
    expect((await call('DELETE', '/account', undefined, s.token)).status).toBe(200);
    for (const t of ['accounts', 'records', 'sessions', 'progress_keys', 'passport_snapshots']) {
      const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<any>();
      expect(n.n, t).toBe(0);
    }
  });
  it('AI tutor route is a disabled stub', async () => {
    const r = await call('POST', '/ai-tutor', { question: 'hi' });
    expect(r.status).toBe(501);
    expect(r.body.enabled).toBe(false);
  });
});
