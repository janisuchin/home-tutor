import { beforeEach, describe, expect, it } from 'vitest';
import { handleApi, type Env } from '../api/src/index';
import { createTestDb } from '../api/test/d1-sqlite';
import { SoftAuthenticator } from './soft-authenticator';

let env: Env;
let ip = 200;
beforeEach(() => {
  env = { DB: createTestDb(), PASSWORD_ITERATIONS: '2000' };
  ip++;
});
const ORIGIN = 'https://home-tutor.example.dev';
async function call(method: string, path: string, body?: unknown, token?: string, origin = ORIGIN) {
  const res = await handleApi(
    new Request(`${ORIGIN}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': `10.2.0.${ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}
async function signedIn() {
  const r = await call('POST', '/auth/signup', { email: 'pk@example.org', password: 'a long family password', consent: true });
  return r.body.token as string;
}
async function addPasskey(token: string, auth: SoftAuthenticator) {
  const o = await call('POST', '/passkeys/register/options', {}, token);
  expect(o.status).toBe(200);
  expect(JSON.stringify(o.body.options)).not.toContain('example.org'); // no email in the passkey
  const response = await auth.create(o.body.options);
  return call('POST', '/passkeys/register/verify', { challengeId: o.body.challengeId, response, label: 'My phone' }, token);
}

describe('passkeys', () => {
  it('a signed-in account adds a passkey and later signs in with it', async () => {
    const token = await signedIn();
    const auth = new SoftAuthenticator('home-tutor.example.dev', ORIGIN);
    expect((await addPasskey(token, auth)).status).toBe(201);
    const list = await call('GET', '/passkeys', undefined, token);
    expect(list.body.passkeys).toHaveLength(1);
    expect(list.body.passkeys[0].label).toBe('My phone');

    const o = await call('POST', '/auth/passkey/options', {});
    expect(o.body.options.rpId).toBe('home-tutor.example.dev');
    const v = await call('POST', '/auth/passkey/verify', { challengeId: o.body.challengeId, response: await auth.get(o.body.options) });
    expect(v.status).toBe(200);
    expect(v.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect((await call('POST', '/sync', { cursor: 0, changes: [] }, v.body.token)).status).toBe(200);
  });

  it('challenges are single-use, and a wrong origin or unknown key is refused', async () => {
    const token = await signedIn();
    const auth = new SoftAuthenticator('home-tutor.example.dev', ORIGIN);
    await addPasskey(token, auth);
    const o = await call('POST', '/auth/passkey/options', {});
    const resp = await auth.get(o.body.options);
    expect((await call('POST', '/auth/passkey/verify', { challengeId: o.body.challengeId, response: resp })).status).toBe(200);
    expect((await call('POST', '/auth/passkey/verify', { challengeId: o.body.challengeId, response: resp })).body.error).toBe('invalid_challenge');
    // The page origin must be the app's own host.
    expect((await call('POST', '/auth/passkey/options', {}, undefined, 'https://evil.example')).body.error).toBe('bad_origin');
    // A signature made for another origin fails verification.
    const o2 = await call('POST', '/auth/passkey/options', {});
    expect((await call('POST', '/auth/passkey/verify', { challengeId: o2.body.challengeId, response: await auth.get(o2.body.options, { origin: 'https://evil.example' }) })).status).toBe(401);
    // A passkey the server never saw.
    const stranger = new SoftAuthenticator('home-tutor.example.dev', ORIGIN);
    await stranger.create({ challenge: 'x', user: { id: 'eA' } });
    const o3 = await call('POST', '/auth/passkey/options', {});
    expect((await call('POST', '/auth/passkey/verify', { challengeId: o3.body.challengeId, response: await stranger.get(o3.body.options) })).body.error).toBe('passkey_unknown');
  });

  it('registration needs a session and a matching challenge; passkeys can be removed', async () => {
    expect((await call('POST', '/passkeys/register/options', {})).status).toBe(401);
    const token = await signedIn();
    const auth = new SoftAuthenticator('home-tutor.example.dev', ORIGIN);
    const o = await call('POST', '/passkeys/register/options', {}, token);
    const response = await auth.create(o.body.options);
    expect((await call('POST', '/passkeys/register/verify', { challengeId: 'nope', response }, token)).body.error).toBe('invalid_challenge');
    expect((await addPasskey(token, auth)).status).toBe(201);
    const id = (await call('GET', '/passkeys', undefined, token)).body.passkeys[0].id;
    expect((await call('DELETE', `/passkeys/${id}`, undefined, token)).status).toBe(200);
    const o2 = await call('POST', '/auth/passkey/options', {});
    expect((await call('POST', '/auth/passkey/verify', { challengeId: o2.body.challengeId, response: await auth.get(o2.body.options) })).body.error).toBe('passkey_unknown');
  });

  it('deleting the account deletes its passkeys', async () => {
    const token = await signedIn();
    await addPasskey(token, new SoftAuthenticator('home-tutor.example.dev', ORIGIN));
    await call('DELETE', '/account', undefined, token);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM passkeys').first<any>()).n).toBe(0);
  });
});
