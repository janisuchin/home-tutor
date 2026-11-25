/**
 * Home Tutor Worker: serves the PWA from static assets and the API on /api/*.
 * One Worker (home-tutor) keeps the API same-origin with the app: no CORS cookies, one deploy.
 */
import { pickWinner, type SyncRecord, type RecordKind } from '../../src/core/sync/merge';
import { randomCode, randomId } from '../../src/core/crypto';
import { DEFAULT_ITERATIONS, emailHash, hashPassword, newToken, pbkdf2, safeEqual, secretHash, tokenHash } from './auth';
import { aiTutorStub } from './ai-tutor';
import { acceptInvite, createInvite, deleteTutorLinks, exportTutorLinks, listTutors, removeTutor, tutorLinks, tutorSync, updateTutor } from './tutors';
import { deletePasskey, deletePasskeyStmts, listPasskeys, loginOptions, loginVerify, registerOptions, registerVerify } from './passkeys';
import { clientIp, err, HttpError, json, rateLimit, readJson, type D1Stmt, type Env } from './http';

export type { D1Like, D1Stmt, Env } from './http';
export { rateLimit } from './http';

const SYNC_KINDS: RecordKind[] = ['family', 'child', 'event', 'group', 'assignment', 'attendance'];
const SESSION_DAYS = 90;
const MAX_RECORD = 64_000;
const MAX_CHANGES = 500;
const PAGE = 1000;

async function requireAccount(req: Request, env: Env): Promise<string> {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!/^[0-9a-f]{64}$/.test(token)) throw new HttpError(401, 'unauthorized');
  const row = await env.DB.prepare('SELECT account_id, expires_at FROM sessions WHERE token_hash = ?').bind(tokenHash(token)).first<{ account_id: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) throw new HttpError(401, 'unauthorized');
  return row.account_id;
}

async function createSession(env: Env, accountId: string) {
  const token = newToken();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash(token), accountId, now, now + SESSION_DAYS * 86400_000)
    .run();
  return token;
}

function validEmail(e: unknown): e is string {
  return typeof e === 'string' && e.length <= 254 && /^\S+@\S+\.\S+$/.test(e);
}
function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 10 && p.length <= 200;
}

function iterations(env: Env) {
  const n = Number(env.PASSWORD_ITERATIONS ?? DEFAULT_ITERATIONS);
  return Number.isFinite(n) && n >= 1000 ? Math.min(n, DEFAULT_ITERATIONS) : DEFAULT_ITERATIONS;
}

// ---------------- auth ----------------
async function signup(req: Request, env: Env) {
  if (!(await rateLimit(env.DB, `signup:${clientIp(req)}`, 10, 3600))) throw new HttpError(429, 'rate_limited');
  const body = await readJson(req);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const { password, consent } = body;
  if (!validEmail(email)) throw new HttpError(400, 'invalid_email');
  if (!validPassword(password)) throw new HttpError(400, 'invalid_password');
  if (consent !== true) throw new HttpError(400, 'consent_required');
  const eh = emailHash(email);
  const exists = await env.DB.prepare('SELECT id FROM accounts WHERE email_hash = ?').bind(eh).first();
  if (exists) throw new HttpError(409, 'email_taken');
  const pw = await hashPassword(password, iterations(env));
  const recoveryKey = randomCode(20);
  const id = randomId();
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO accounts (id, email_hash, pw_hash, pw_salt, pw_iter, recovery_hash, consent_at, created_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
  )
    .bind(id, eh, pw.hash, pw.salt, pw.iterations, secretHash('recovery', recoveryKey), now, now)
    .run();
  const token = await createSession(env, id);
  return json({ token, accountId: id, recoveryKey }, 201);
}

async function login(req: Request, env: Env) {
  const body = await readJson(req);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const { password } = body;
  if (!validEmail(email) || typeof password !== 'string') throw new HttpError(400, 'invalid_credentials');
  const eh = emailHash(email);
  if (!(await rateLimit(env.DB, `login:${eh}`, 5, 900))) throw new HttpError(429, 'rate_limited');
  if (!(await rateLimit(env.DB, `login-ip:${clientIp(req)}`, 30, 3600))) throw new HttpError(429, 'rate_limited');
  const row = await env.DB.prepare('SELECT id, pw_hash, pw_salt, pw_iter FROM accounts WHERE email_hash = ?').bind(eh).first<any>();
  if (!row) {
    await pbkdf2(password, '00'.repeat(16), iterations(env)); // same work either way (no account probing by timing)
    throw new HttpError(401, 'invalid_credentials');
  }
  const h = await pbkdf2(password, row.pw_salt, row.pw_iter);
  if (!safeEqual(h, row.pw_hash)) throw new HttpError(401, 'invalid_credentials');
  return json({ token: await createSession(env, row.id), accountId: row.id });
}

async function recover(req: Request, env: Env) {
  const body = await readJson(req);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const { recoveryKey, newPassword } = body;
  if (!validEmail(email) || typeof recoveryKey !== 'string') throw new HttpError(400, 'invalid_recovery');
  if (!validPassword(newPassword)) throw new HttpError(400, 'invalid_password');
  const eh = emailHash(email);
  if (!(await rateLimit(env.DB, `recover:${eh}`, 5, 3600))) throw new HttpError(429, 'rate_limited');
  if (!(await rateLimit(env.DB, `recover-ip:${clientIp(req)}`, 20, 3600))) throw new HttpError(429, 'rate_limited');
  const row = await env.DB.prepare('SELECT id, recovery_hash FROM accounts WHERE email_hash = ?').bind(eh).first<any>();
  const clean = recoveryKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!row || !safeEqual(secretHash('recovery', clean), row.recovery_hash)) throw new HttpError(401, 'invalid_recovery');
  const pw = await hashPassword(newPassword, iterations(env));
  const nextKey = randomCode(20);
  await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iter = ?, recovery_hash = ? WHERE id = ?').bind(pw.hash, pw.salt, pw.iterations, secretHash('recovery', nextKey), row.id),
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(row.id),
  ]);
  return json({ token: await createSession(env, row.id), accountId: row.id, recoveryKey: nextKey });
}

async function logout(req: Request, env: Env) {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash(token)).run();
  return json({ ok: true });
}

// ---------------- sync ----------------
function validRecord(r: any): r is SyncRecord {
  return (
    r &&
    SYNC_KINDS.includes(r.kind) &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    r.id.length <= 64 &&
    typeof r.updatedAt === 'number' &&
    r.updatedAt > 0 &&
    r.updatedAt < Date.now() + 7 * 86400_000 &&
    typeof r.data === 'object' &&
    r.data !== null &&
    JSON.stringify(r.data).length <= MAX_RECORD
  );
}

function childIdOf(r: SyncRecord): string | null {
  if (r.kind === 'child') return r.id;
  if (r.kind === 'event') return typeof (r.data as any)?.childId === 'string' ? (r.data as any).childId : null;
  return null;
}

export async function sync(req: Request, env: Env, accountId: string) {
  const body = await readJson(req);
  const cursor = Number(body.cursor ?? 0);
  const changes: unknown[] = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_CHANGES) throw new HttpError(413, 'too_many_changes');
  const valid = changes.filter(validRecord);
  // Existing versions of the incoming records.
  const winners: SyncRecord[] = [];
  for (const r of valid) {
    const row = await env.DB.prepare('SELECT updated_at, deleted, data FROM records WHERE account_id = ? AND kind = ? AND id = ?')
      .bind(accountId, r.kind, r.id)
      .first<{ updated_at: number; deleted: number; data: string }>();
    const cur: SyncRecord | undefined = row ? { kind: r.kind, id: r.id, updatedAt: row.updated_at, deleted: !!row.deleted, data: JSON.parse(row.data) } : undefined;
    const incoming: SyncRecord = { kind: r.kind, id: r.id, updatedAt: r.updatedAt, deleted: !!r.deleted, data: r.data };
    if (pickWinner(cur, incoming) === incoming) winners.push(incoming);
  }
  if (winners.length) {
    const seqRow = await env.DB.prepare('UPDATE accounts SET seq = seq + ? WHERE id = ? RETURNING seq').bind(winners.length, accountId).first<{ seq: number }>();
    let seq = (seqRow?.seq ?? winners.length) - winners.length;
    const stmts: D1Stmt[] = [];
    for (const w of winners) {
      seq++;
      stmts.push(
        env.DB.prepare(
          'INSERT OR REPLACE INTO records (account_id, kind, id, child_id, updated_at, deleted, data, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(accountId, w.kind, w.id, childIdOf(w), w.updatedAt, w.deleted ? 1 : 0, JSON.stringify(w.data), seq),
      );
      if (w.kind === 'child' && w.deleted) {
        // Deleting a child deletes their progress, Progress Keys and passport snapshot.
        stmts.push(env.DB.prepare("DELETE FROM records WHERE account_id = ? AND kind = 'event' AND child_id = ?").bind(accountId, w.id));
        stmts.push(env.DB.prepare('DELETE FROM passport_snapshots WHERE account_id = ? AND child_id = ?').bind(accountId, w.id));
        stmts.push(env.DB.prepare('UPDATE progress_keys SET revoked_at = ? WHERE account_id = ? AND child_id = ? AND revoked_at IS NULL').bind(Date.now(), accountId, w.id));
      }
    }
    await env.DB.batch(stmts);
  }
  const rows = await env.DB.prepare('SELECT kind, id, updated_at, deleted, data, seq FROM records WHERE account_id = ? AND seq > ? ORDER BY seq LIMIT ?')
    .bind(accountId, cursor, PAGE)
    .all<{ kind: RecordKind; id: string; updated_at: number; deleted: number; data: string; seq: number }>();
  const out = rows.results.map((r) => ({ kind: r.kind, id: r.id, updatedAt: r.updated_at, deleted: !!r.deleted, data: JSON.parse(r.data) }));
  const next = rows.results.length ? rows.results[rows.results.length - 1].seq : cursor;
  return json({ cursor: next, changes: out, more: rows.results.length === PAGE, rejected: changes.length - valid.length });
}

// ---------------- progress keys ----------------
async function childExists(env: Env, accountId: string, childId: string) {
  const row = await env.DB.prepare("SELECT deleted FROM records WHERE account_id = ? AND kind = 'child' AND id = ?").bind(accountId, childId).first<{ deleted: number }>();
  return !!row && !row.deleted;
}

async function createKey(req: Request, env: Env, accountId: string) {
  const { childId, code, expiresAt } = await readJson(req);
  if (typeof childId !== 'string' || typeof code !== 'string' || !/^[A-HJ-NP-Z2-9]{12,20}$/.test(code)) throw new HttpError(400, 'invalid_key');
  if (expiresAt !== undefined && (typeof expiresAt !== 'number' || expiresAt < Date.now())) throw new HttpError(400, 'invalid_expiry');
  if (!(await childExists(env, accountId, childId))) throw new HttpError(404, 'child_not_synced');
  const id = randomId();
  await env.DB.prepare('INSERT INTO progress_keys (id, account_id, child_id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, accountId, childId, secretHash('progress-key', code), Date.now(), expiresAt ?? null)
    .run();
  return json({ id }, 201);
}

async function revokeKey(env: Env, accountId: string, id: string) {
  await env.DB.prepare('UPDATE progress_keys SET revoked_at = ? WHERE id = ? AND account_id = ?').bind(Date.now(), id, accountId).run();
  return json({ ok: true });
}

async function putSnapshot(req: Request, env: Env, accountId: string, childId: string) {
  const snap = await readJson(req);
  const text = JSON.stringify(snap);
  if (text.length > 200_000 || snap?.version !== 1) throw new HttpError(400, 'invalid_snapshot');
  if (!(await childExists(env, accountId, childId))) throw new HttpError(404, 'child_not_synced');
  await env.DB.prepare('INSERT OR REPLACE INTO passport_snapshots (account_id, child_id, data, updated_at) VALUES (?, ?, ?, ?)')
    .bind(accountId, childId, text, Date.now())
    .run();
  return json({ ok: true });
}

async function readPassport(req: Request, env: Env, code: string) {
  if (!(await rateLimit(env.DB, `passport-ip:${clientIp(req)}`, 60, 3600))) throw new HttpError(429, 'rate_limited');
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const key = await env.DB.prepare('SELECT account_id, child_id, expires_at, revoked_at FROM progress_keys WHERE code_hash = ?')
    .bind(secretHash('progress-key', clean))
    .first<{ account_id: string; child_id: string; expires_at: number | null; revoked_at: number | null }>();
  if (!key || key.revoked_at || (key.expires_at && key.expires_at < Date.now())) throw new HttpError(404, 'not_found');
  const snap = await env.DB.prepare('SELECT data FROM passport_snapshots WHERE account_id = ? AND child_id = ?').bind(key.account_id, key.child_id).first<{ data: string }>();
  if (!snap) throw new HttpError(404, 'not_found');
  return json({ snapshot: JSON.parse(snap.data), expiresAt: key.expires_at ?? undefined });
}

// ---------------- account data ----------------
async function exportAll(env: Env, accountId: string) {
  const records = await env.DB.prepare('SELECT kind, id, updated_at, deleted, data FROM records WHERE account_id = ? ORDER BY seq').bind(accountId).all<any>();
  const keys = await env.DB.prepare('SELECT id, child_id, created_at, expires_at, revoked_at FROM progress_keys WHERE account_id = ?').bind(accountId).all<any>();
  const snaps = await env.DB.prepare('SELECT child_id, data, updated_at FROM passport_snapshots WHERE account_id = ?').bind(accountId).all<any>();
  const acct = await env.DB.prepare('SELECT id, consent_at, created_at FROM accounts WHERE id = ?').bind(accountId).first<any>();
  return json({
    exportedAt: new Date().toISOString(),
    account: acct,
    records: records.results.map((r) => ({ ...r, data: JSON.parse(r.data) })),
    progressKeys: keys.results,
    passportSnapshots: snaps.results.map((s) => ({ ...s, data: JSON.parse(s.data) })),
    tutors: await exportTutorLinks(env, accountId),
    passkeys: (await env.DB.prepare('SELECT id, label, created_at, last_used_at FROM passkeys WHERE account_id = ?').bind(accountId).all<any>()).results,
  });
}

async function deleteAccount(env: Env, accountId: string) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM records WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM progress_keys WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM passport_snapshots WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId),
    ...deleteTutorLinks(env, accountId),
    ...deletePasskeyStmts(env, accountId),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
  ]);
  return json({ ok: true });
}

// ---------------- e2e clean-up check ----------------
/** The e2e helper testEmail() makes addresses of exactly this shape on the reserved example.org domain. */
export const TEST_EMAIL = /^[a-z0-9]{1,16}-\d{10,16}-[a-z0-9]{1,16}@example\.org$/;

/**
 * Test-only clean-up verification: given the addresses an e2e run signed up with, reports how many
 * still have an account. Only e2e-shaped addresses on example.org (reserved by IANA, so no real
 * family can use it) are accepted, so this cannot be used to probe real accounts. Count only.
 */
async function testLeftovers(req: Request, env: Env) {
  if (!(await rateLimit(env.DB, `leftovers:${clientIp(req)}`, 30, 3600))) throw new HttpError(429, 'rate_limited');
  const body = await readJson(req);
  const emails: unknown = body.emails;
  if (!Array.isArray(emails) || emails.length > 100 || !emails.every((e) => typeof e === 'string' && TEST_EMAIL.test(e))) throw new HttpError(400, 'test_emails_only');
  let left = 0;
  for (const e of new Set(emails as string[])) {
    if (await env.DB.prepare('SELECT id FROM accounts WHERE email_hash = ?').bind(emailHash(e)).first()) left++;
  }
  return json({ checked: emails.length, left });
}

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '');
  const m = req.method;
  try {
    if (m === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE', 'access-control-allow-headers': 'content-type,authorization', 'access-control-max-age': '86400' },
      });
    if (path === '/health' && m === 'GET') return json({ ok: true, service: 'home-tutor' });
    if (path === '/auth/signup' && m === 'POST') return await signup(req, env);
    if (path === '/auth/login' && m === 'POST') return await login(req, env);
    if (path === '/auth/recover' && m === 'POST') return await recover(req, env);
    if (path === '/auth/logout' && m === 'POST') return await logout(req, env);
    if (path === '/auth/passkey/options' && m === 'POST') return await loginOptions(req, env);
    if (path === '/auth/passkey/verify' && m === 'POST') {
      const id = await loginVerify(req, env);
      return json({ token: await createSession(env, id), accountId: id });
    }
    const passport = path.match(/^\/passport\/([A-Za-z0-9-]{8,40})$/);
    if (passport && m === 'GET') return await readPassport(req, env, passport[1]);
    if (path === '/ai-tutor' && m === 'POST') return aiTutorStub(env);
    if (path === '/test/leftovers' && m === 'POST') return await testLeftovers(req, env);

    const accountId = await requireAccount(req, env);
    if (path === '/sync' && m === 'POST') return await sync(req, env, accountId);
    if (path === '/keys' && m === 'POST') return await createKey(req, env, accountId);
    const key = path.match(/^\/keys\/([0-9a-f-]{36})$/);
    if (key && m === 'DELETE') return await revokeKey(env, accountId, key[1]);
    const snap = path.match(/^\/passport-snapshot\/([0-9a-zA-Z-]{1,64})$/);
    if (snap && m === 'PUT') return await putSnapshot(req, env, accountId, snap[1]);
    if (path === '/account/export' && m === 'GET') return await exportAll(env, accountId);
    if (path === '/account' && m === 'DELETE') return await deleteAccount(env, accountId);
    // Passkeys (optional extra sign-in).
    if (path === '/passkeys/register/options' && m === 'POST') return await registerOptions(req, env, accountId);
    if (path === '/passkeys/register/verify' && m === 'POST') return await registerVerify(req, env, accountId);
    if (path === '/passkeys' && m === 'GET') return await listPasskeys(env, accountId);
    const pk = path.match(/^\/passkeys\/([A-Za-z0-9_-]{1,1024})$/);
    if (pk && m === 'DELETE') return await deletePasskey(env, accountId, pk[1]);
    // Tutor accounts: parent side (/tutors) and tutor side (/tutor).
    if (path === '/tutors' && m === 'POST') return await createInvite(req, env, accountId);
    if (path === '/tutors' && m === 'GET') return await listTutors(env, accountId);
    const tl = path.match(/^\/tutors\/([0-9a-f-]{36})$/);
    if (tl && m === 'PUT') return await updateTutor(req, env, accountId, tl[1]);
    if (tl && m === 'DELETE') return await removeTutor(env, accountId, tl[1]);
    if (path === '/tutor/accept' && m === 'POST') return await acceptInvite(req, env, accountId);
    if (path === '/tutor/links' && m === 'GET') return await tutorLinks(env, accountId);
    const ts = path.match(/^\/tutor\/links\/([0-9a-f-]{36})\/sync$/);
    if (ts && m === 'POST') return await tutorSync(req, env, accountId, ts[1]);
    return err(404, 'not_found');
  } catch (e) {
    if (e instanceof HttpError) return err(e.status, e.code);
    console.error('api error', (e as Error).message);
    return err(500, 'server_error');
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env);
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('Not found', { status: 404 });
  },
};
