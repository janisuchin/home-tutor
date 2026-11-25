import { beforeEach, describe, expect, it } from 'vitest';
import { handleApi, type Env } from '../api/src/index';
import { createTestDb } from '../api/test/d1-sqlite';

let env: Env;
let ip = 100;
beforeEach(() => {
  env = { DB: createTestDb(), PASSWORD_ITERATIONS: '2000' };
  ip++;
});

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await handleApi(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': `10.1.0.${ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}
async function signup(email: string) {
  const r = await call('POST', '/auth/signup', { email, password: 'a long family password', consent: true });
  expect(r.status).toBe(201);
  return r.body.token as string;
}
const child = (id: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({ kind: 'child', id, updatedAt, data: { id, name: id, health: { modules: {} }, interests: [], ...extra } });
const event = (id: string, childId: string, by = 'parent') => ({ kind: 'event', id, updatedAt: 1000, data: { id, childId, type: 'completed', by, at: 1000 } });

/** A parent with two synced children (Asha, Kabir) and a family record. */
async function parentWithChildren() {
  const parent = await signup('parent@example.org');
  const r = await call('POST', '/sync', { cursor: 0, changes: [{ kind: 'family', id: 'f1', updatedAt: 1000, data: { id: 'f1', name: 'Fam', pinHash: 'secret-pin-hash' } }, child('asha', 1000), child('kabir', 1000), event('e1', 'asha'), event('e2', 'kabir')] }, parent);
  expect(r.status).toBe(200);
  return parent;
}
async function invite(parent: string, childIds: string[]) {
  const r = await call('POST', '/tutors', { childIds, label: 'Maths tutor', familyLabel: 'The Fam' }, parent);
  expect(r.status).toBe(201);
  return r.body as { id: string; code: string; expiresAt: number };
}

describe('tutor accounts', () => {
  it('a tutor accepts an invite and sees only the shared children, never the family record', async () => {
    const parent = await parentWithChildren();
    const inv = await invite(parent, ['asha']);
    expect(inv.code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    const tutor = await signup('tutor@example.org');
    const acc = await call('POST', '/tutor/accept', { code: inv.code.toLowerCase() }, tutor);
    expect(acc.status).toBe(200);
    expect(acc.body.link.familyLabel).toBe('The Fam');
    const links = await call('GET', '/tutor/links', undefined, tutor);
    expect(links.body.links).toHaveLength(1);
    const s = await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: [] }, tutor);
    expect(s.status).toBe(200);
    const ids = s.body.changes.map((c: any) => `${c.kind}:${c.id}`).sort();
    expect(ids).toEqual(['child:asha', 'event:e1']);
    expect(JSON.stringify(s.body)).not.toContain('secret-pin-hash');
    expect(s.body.childIds).toEqual(['asha']);
  });

  it('invite codes are single-use, expire, and cannot be accepted by the parent', async () => {
    const parent = await parentWithChildren();
    const inv = await invite(parent, ['asha']);
    expect((await call('POST', '/tutor/accept', { code: inv.code }, parent)).body.error).toBe('own_invite');
    const t1 = await signup('t1@example.org');
    const t2 = await signup('t2@example.org');
    expect((await call('POST', '/tutor/accept', { code: inv.code }, t1)).status).toBe(200);
    expect((await call('POST', '/tutor/accept', { code: inv.code }, t2)).status).toBe(404);
    const inv2 = await invite(parent, ['kabir']);
    await env.DB.prepare('UPDATE tutor_links SET expires_at = ? WHERE id = ?').bind(Date.now() - 1, inv2.id).run();
    expect((await call('POST', '/tutor/accept', { code: inv2.code }, t2)).status).toBe(404);
    // Only a hash of the code is stored.
    const rows = await env.DB.prepare('SELECT * FROM tutor_links').all<any>();
    expect(JSON.stringify(rows.results)).not.toContain(inv2.code);
  });

  it('a tutor can add progress for shared children, which the parent then receives', async () => {
    const parent = await parentWithChildren();
    const inv = await invite(parent, ['asha']);
    const tutor = await signup('tutor@example.org');
    await call('POST', '/tutor/accept', { code: inv.code }, tutor);
    const s = await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: [event('t-e1', 'asha', 'parent'), child('asha', 5000, { interests: ['horses'], name: 'Hacked', health: { modules: { 'growing-up-girl': true } } })] }, tutor);
    expect(s.body.rejected).toBe(0);
    const p = await call('POST', '/sync', { cursor: 0, changes: [] }, parent);
    const ev = p.body.changes.find((c: any) => c.id === 't-e1');
    expect(ev.data.by).toBe('tutor'); // stamped by the server, whatever the device sent
    const asha = p.body.changes.find((c: any) => c.kind === 'child' && c.id === 'asha');
    expect(asha.data.interests).toEqual(['horses']); // allowed learning field
    expect(asha.data.name).toBe('asha'); // not allowed: unchanged
    expect(asha.data.health.modules).toEqual({}); // health settings stay with the parent
  });

  it('a tutor cannot touch unshared children, delete anything or write other record kinds', async () => {
    const parent = await parentWithChildren();
    const inv = await invite(parent, ['asha']);
    const tutor = await signup('tutor@example.org');
    await call('POST', '/tutor/accept', { code: inv.code }, tutor);
    const bad = [
      event('x1', 'kabir'),
      child('kabir', 9000, { interests: ['x'] }),
      { ...child('asha', 9000), deleted: true },
      { kind: 'family', id: 'f1', updatedAt: 9000, data: { id: 'f1', name: 'Mine now' } },
      { kind: 'group', id: 'g1', updatedAt: 9000, data: { id: 'g1' } },
    ];
    const s = await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: bad }, tutor);
    expect(s.body.rejected).toBe(5);
    const p = await call('POST', '/sync', { cursor: 0, changes: [] }, parent);
    expect(p.body.changes.find((c: any) => c.id === 'x1')).toBeUndefined();
    expect(p.body.changes.find((c: any) => c.kind === 'family').data.name).toBe('Fam');
    expect(p.body.changes.find((c: any) => c.id === 'asha').deleted).toBe(false);
    // Tutors cannot manage the parent's tutors, keys or snapshots through the link either.
    expect((await call('DELETE', `/tutors/${inv.id}`, undefined, tutor)).status).toBe(404);
    expect((await call('PUT', `/tutors/${inv.id}`, { childIds: ['kabir'] }, tutor)).status).toBe(404);
    expect((await call('POST', '/keys', { childId: 'asha', code: 'ABCDEFGHJKLM' }, tutor)).status).toBe(404);
    expect((await call('PUT', '/passport-snapshot/asha', { version: 1 }, tutor)).status).toBe(404);
    // Another account cannot use the link at all.
    const stranger = await signup('stranger@example.org');
    expect((await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: [] }, stranger)).status).toBe(403);
  });

  it('the parent can change the shared children and remove the tutor at any time', async () => {
    const parent = await parentWithChildren();
    const inv = await invite(parent, ['asha']);
    const tutor = await signup('tutor@example.org');
    await call('POST', '/tutor/accept', { code: inv.code }, tutor);
    const list = await call('GET', '/tutors', undefined, parent);
    expect(list.body.tutors[0]).toMatchObject({ id: inv.id, label: 'Maths tutor', childIds: ['asha'] });
    expect(list.body.tutors[0].acceptedAt).toBeTruthy();
    expect((await call('PUT', `/tutors/${inv.id}`, { childIds: ['asha', 'kabir'] }, parent)).status).toBe(200);
    const s = await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: [] }, tutor);
    expect(s.body.childIds.sort()).toEqual(['asha', 'kabir']);
    expect((await call('PUT', `/tutors/${inv.id}`, { childIds: ['nobody'] }, parent)).status).toBe(404);
    expect((await call('DELETE', `/tutors/${inv.id}`, undefined, parent)).status).toBe(200);
    expect((await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: [] }, tutor)).status).toBe(403);
    expect((await call('GET', '/tutor/links', undefined, tutor)).body.links).toHaveLength(0);
    expect((await call('GET', '/tutors', undefined, parent)).body.tutors).toHaveLength(0);
  });

  it('a deleted child disappears for the tutor, and deleting either account removes the link', async () => {
    const parent = await parentWithChildren();
    const inv = await invite(parent, ['asha', 'kabir']);
    const tutor = await signup('tutor@example.org');
    await call('POST', '/tutor/accept', { code: inv.code }, tutor);
    await call('POST', '/sync', { cursor: 0, changes: [{ ...child('kabir', 2000), deleted: true }] }, parent);
    const s = await call('POST', `/tutor/links/${inv.id}/sync`, { cursor: 0, changes: [] }, tutor);
    expect(s.body.childIds).toEqual(['asha']);
    expect(s.body.changes.some((c: any) => c.id === 'kabir')).toBe(false);
    expect((await call('POST', '/tutors', { childIds: ['ghost'] }, parent)).status).toBe(404);
    expect((await call('DELETE', '/account', undefined, tutor)).status).toBe(200);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM tutor_links').first<any>()).n).toBe(0);
  });
});
