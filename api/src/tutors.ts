/**
 * Tutor accounts (round 2). A parent invites a tutor with a one-time code. The tutor signs in with
 * their own account on their own device and, through the link, sees and updates only the children
 * the parent shared. Every route checks, on the server:
 *  - parent routes: the link belongs to the caller's account;
 *  - tutor routes: the link was accepted by the caller and has not been removed;
 *  - tutor writes: only progress events and a few learning fields of shared, live children;
 *    no deletions, no family, group or assignment records, no Progress Keys, no exports.
 * The parent can remove a tutor at any time; access ends on the tutor's next request.
 */
import { pickWinner, type SyncRecord } from '../../src/core/sync/merge';
import { randomCode, randomId } from '../../src/core/crypto';
import { secretHash } from './auth';
import { clientIp, HttpError, json, rateLimit, readJson, type D1Stmt, type Env } from './http';

export const INVITE_DAYS = 7;
const MAX_LINKS = 20;
const MAX_CHILDREN = 50;
const MAX_CHANGES = 500;
const MAX_RECORD = 64_000;
const PAGE = 1000;

/** The child-profile fields a tutor may change. Everything else stays as the parent set it. */
export const TUTOR_CHILD_FIELDS = ['levelOverrides', 'interests', 'goals', 'strengths', 'growingAreas', 'learningStyles'] as const;

interface LinkRow {
  id: string;
  parent_account_id: string;
  label: string;
  family_label: string;
  child_ids: string;
  created_at: number;
  expires_at: number;
  accepted_at: number | null;
  tutor_account_id: string | null;
  removed_at: number | null;
}

const cleanText = (v: unknown, max = 60) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');

async function liveChildIds(env: Env, accountId: string, ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) {
    const row = await env.DB.prepare("SELECT deleted FROM records WHERE account_id = ? AND kind = 'child' AND id = ?").bind(accountId, id).first<{ deleted: number }>();
    if (row && !row.deleted) out.push(id);
  }
  return out;
}

async function parseChildIds(env: Env, accountId: string, v: unknown): Promise<string[]> {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_CHILDREN || !v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 64))
    throw new HttpError(400, 'invalid_children');
  const ids = [...new Set(v as string[])];
  const live = await liveChildIds(env, accountId, ids);
  if (live.length !== ids.length) throw new HttpError(404, 'child_not_synced');
  return ids;
}

function linkOut(r: LinkRow) {
  return {
    id: r.id,
    label: r.label,
    familyLabel: r.family_label,
    childIds: JSON.parse(r.child_ids) as string[],
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at ?? undefined,
  };
}

// ---------------- parent side ----------------
export async function createInvite(req: Request, env: Env, accountId: string) {
  const body = await readJson(req);
  const childIds = await parseChildIds(env, accountId, body.childIds);
  const active = await env.DB.prepare('SELECT COUNT(*) AS n FROM tutor_links WHERE parent_account_id = ? AND removed_at IS NULL').bind(accountId).first<{ n: number }>();
  if ((active?.n ?? 0) >= MAX_LINKS) throw new HttpError(409, 'too_many_tutors');
  const code = randomCode(12);
  const id = randomId();
  const now = Date.now();
  const expiresAt = now + INVITE_DAYS * 86400_000;
  await env.DB.prepare(
    'INSERT INTO tutor_links (id, parent_account_id, code_hash, label, family_label, child_ids, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, accountId, secretHash('tutor-invite', code), cleanText(body.label), cleanText(body.familyLabel), JSON.stringify(childIds), now, expiresAt)
    .run();
  return json({ id, code, expiresAt }, 201);
}

export async function listTutors(env: Env, accountId: string) {
  const rows = await env.DB.prepare('SELECT * FROM tutor_links WHERE parent_account_id = ? AND removed_at IS NULL ORDER BY created_at').bind(accountId).all<LinkRow>();
  return json({ tutors: rows.results.map(linkOut) });
}

async function ownLink(env: Env, accountId: string, id: string): Promise<LinkRow> {
  const row = await env.DB.prepare('SELECT * FROM tutor_links WHERE id = ? AND parent_account_id = ? AND removed_at IS NULL').bind(id, accountId).first<LinkRow>();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

export async function updateTutor(req: Request, env: Env, accountId: string, id: string) {
  await ownLink(env, accountId, id);
  const body = await readJson(req);
  const childIds = await parseChildIds(env, accountId, body.childIds);
  await env.DB.prepare('UPDATE tutor_links SET child_ids = ?, label = COALESCE(?, label) WHERE id = ? AND parent_account_id = ?')
    .bind(JSON.stringify(childIds), typeof body.label === 'string' ? cleanText(body.label) : null, id, accountId)
    .run();
  return json({ ok: true });
}

export async function removeTutor(env: Env, accountId: string, id: string) {
  await ownLink(env, accountId, id);
  await env.DB.prepare('UPDATE tutor_links SET removed_at = ? WHERE id = ? AND parent_account_id = ?').bind(Date.now(), id, accountId).run();
  return json({ ok: true });
}

// ---------------- tutor side ----------------
export async function acceptInvite(req: Request, env: Env, accountId: string) {
  if (!(await rateLimit(env.DB, `tutor-accept:${accountId}`, 10, 3600))) throw new HttpError(429, 'rate_limited');
  if (!(await rateLimit(env.DB, `tutor-accept-ip:${clientIp(req)}`, 30, 3600))) throw new HttpError(429, 'rate_limited');
  const { code } = await readJson(req);
  const clean = typeof code === 'string' ? code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(clean)) throw new HttpError(400, 'invalid_invite');
  const row = await env.DB.prepare('SELECT * FROM tutor_links WHERE code_hash = ? AND accepted_at IS NULL AND removed_at IS NULL')
    .bind(secretHash('tutor-invite', clean))
    .first<LinkRow>();
  if (!row || row.expires_at < Date.now()) throw new HttpError(404, 'invalid_invite');
  if (row.parent_account_id === accountId) throw new HttpError(400, 'own_invite');
  // One-time code: the hash is replaced so the same code can never be accepted again.
  await env.DB.prepare('UPDATE tutor_links SET tutor_account_id = ?, accepted_at = ?, code_hash = ? WHERE id = ? AND accepted_at IS NULL')
    .bind(accountId, Date.now(), `used:${randomId()}`, row.id)
    .run();
  return json({ link: linkOut({ ...row, tutor_account_id: accountId, accepted_at: Date.now() }) });
}

export async function tutorLinks(env: Env, accountId: string) {
  const rows = await env.DB.prepare('SELECT * FROM tutor_links WHERE tutor_account_id = ? AND removed_at IS NULL ORDER BY accepted_at').bind(accountId).all<LinkRow>();
  return json({ links: rows.results.map((r) => ({ id: r.id, familyLabel: r.family_label, childIds: JSON.parse(r.child_ids) as string[], acceptedAt: r.accepted_at })) });
}

async function tutorLink(env: Env, accountId: string, id: string): Promise<LinkRow> {
  const row = await env.DB.prepare('SELECT * FROM tutor_links WHERE id = ? AND tutor_account_id = ? AND removed_at IS NULL').bind(id, accountId).first<LinkRow>();
  // 403 tells the tutor's device to forget this family's data (removed or never theirs).
  if (!row) throw new HttpError(403, 'tutor_access_removed');
  return row;
}

function okId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64;
}

/**
 * Sync for a tutor through one link. Reads: the shared children and their progress events.
 * Writes: new progress events and allowed learning fields of shared children only.
 */
/** Longest tutor session note the server keeps (D-058). */
export const NOTE_MAX = 500;

export async function tutorSync(req: Request, env: Env, tutorAccountId: string, linkId: string) {
  const link = await tutorLink(env, tutorAccountId, linkId);
  const parent = link.parent_account_id;
  const shared = await liveChildIds(env, parent, JSON.parse(link.child_ids) as string[]);
  const sharedSet = new Set(shared);
  const body = await readJson(req);
  const cursor = Number(body.cursor ?? 0);
  const changes: any[] = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_CHANGES) throw new HttpError(413, 'too_many_changes');

  const writes: SyncRecord[] = [];
  let rejected = 0;
  for (const r of changes) {
    const fine =
      r && okId(r.id) && typeof r.updatedAt === 'number' && r.updatedAt > 0 && r.updatedAt < Date.now() + 7 * 86400_000 && !r.deleted && typeof r.data === 'object' && r.data !== null && JSON.stringify(r.data).length <= MAX_RECORD;
    if (!fine) {
      rejected++;
      continue;
    }
    if (r.kind === 'event') {
      if (!sharedSet.has(r.data.childId)) {
        rejected++;
        continue;
      }
      const exists = await env.DB.prepare("SELECT 1 AS x FROM records WHERE account_id = ? AND kind = 'event' AND id = ?").bind(parent, r.id).first();
      if (exists) continue; // events never change: first write wins
      // Stamped by the server: who wrote it (a tutor, through this link). A session note is short text.
      const data: Record<string, unknown> = { ...r.data, id: r.id, by: 'tutor', tutorLinkId: linkId };
      if (data.text !== undefined) {
        if (typeof data.text !== 'string') delete data.text;
        else data.text = data.text.slice(0, NOTE_MAX);
      }
      writes.push({ kind: 'event', id: r.id, updatedAt: r.updatedAt, data });
    } else if (r.kind === 'child') {
      if (!sharedSet.has(r.id)) {
        rejected++;
        continue;
      }
      const row = await env.DB.prepare("SELECT updated_at, deleted, data FROM records WHERE account_id = ? AND kind = 'child' AND id = ?").bind(parent, r.id).first<{ updated_at: number; deleted: number; data: string }>();
      if (!row || row.deleted) {
        rejected++;
        continue;
      }
      const current = JSON.parse(row.data);
      const next: Record<string, unknown> = { ...current };
      for (const f of TUTOR_CHILD_FIELDS) if (f in r.data) next[f] = r.data[f];
      const incoming: SyncRecord = { kind: 'child', id: r.id, updatedAt: r.updatedAt, data: { ...next, updatedAt: r.updatedAt } };
      const cur: SyncRecord = { kind: 'child', id: r.id, updatedAt: row.updated_at, data: current };
      if (pickWinner(cur, incoming) === incoming) writes.push(incoming);
    } else {
      rejected++; // tutors cannot write family, group, assignment or any other record
    }
  }

  if (writes.length) {
    const seqRow = await env.DB.prepare('UPDATE accounts SET seq = seq + ? WHERE id = ? RETURNING seq').bind(writes.length, parent).first<{ seq: number }>();
    let seq = (seqRow?.seq ?? writes.length) - writes.length;
    const stmts: D1Stmt[] = writes.map((w) =>
      env.DB.prepare('INSERT OR REPLACE INTO records (account_id, kind, id, child_id, updated_at, deleted, data, seq) VALUES (?, ?, ?, ?, ?, 0, ?, ?)').bind(
        parent,
        w.kind,
        w.id,
        w.kind === 'child' ? w.id : (w.data as any).childId,
        w.updatedAt,
        JSON.stringify(w.data),
        ++seq,
      ),
    );
    await env.DB.batch(stmts);
  }

  let out: { kind: 'child' | 'event'; id: string; updatedAt: number; data: unknown }[] = [];
  let next = cursor;
  let more = false;
  if (shared.length) {
    const marks = shared.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT kind, id, updated_at, data, seq FROM records WHERE account_id = ? AND seq > ? AND kind IN ('child', 'event') AND deleted = 0 AND child_id IN (${marks}) ORDER BY seq LIMIT ?`,
    )
      .bind(parent, cursor, ...shared, PAGE)
      .all<{ kind: 'child' | 'event'; id: string; updated_at: number; data: string; seq: number }>();
    out = rows.results.map((r) => ({ kind: r.kind, id: r.id, updatedAt: r.updated_at, data: JSON.parse(r.data) }));
    if (rows.results.length) next = rows.results[rows.results.length - 1].seq;
    more = rows.results.length === PAGE;
  }
  return json({ cursor: next, changes: out, more, rejected, childIds: shared, familyLabel: link.family_label });
}

/** Statements that remove every tutor link of an account, as parent or as tutor. */
export function deleteTutorLinks(env: Env, accountId: string): D1Stmt[] {
  return [
    env.DB.prepare('DELETE FROM tutor_links WHERE parent_account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM tutor_links WHERE tutor_account_id = ?').bind(accountId),
  ];
}

export async function exportTutorLinks(env: Env, accountId: string) {
  const asParent = await env.DB.prepare('SELECT * FROM tutor_links WHERE parent_account_id = ?').bind(accountId).all<LinkRow>();
  const asTutor = await env.DB.prepare('SELECT * FROM tutor_links WHERE tutor_account_id = ?').bind(accountId).all<LinkRow>();
  return {
    invitedTutors: asParent.results.map((r) => ({ ...linkOut(r), removedAt: r.removed_at ?? undefined })),
    tutoringFor: asTutor.results.map((r) => ({ id: r.id, familyLabel: r.family_label, childIds: JSON.parse(r.child_ids), acceptedAt: r.accepted_at, removedAt: r.removed_at ?? undefined })),
  };
}
