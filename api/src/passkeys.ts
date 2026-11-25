/**
 * Passkeys (WebAuthn) as an optional extra sign-in (round 2). A signed-in parent or tutor can add
 * a passkey; later they can sign in with it instead of the password. Email + password and the
 * recovery key keep working, so losing a device never locks anyone out.
 *
 * Verification uses @simplewebauthn/server (WebCrypto, runs in Workers). The relying party is the
 * host that served the request, so the web app (same origin) works on any deployment. Challenges
 * are single-use and expire after 5 minutes. Only public keys are stored.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { randomId } from '../../src/core/crypto';
import { clientIp, HttpError, json, rateLimit, readJson, type Env } from './http';

const CHALLENGE_MS = 5 * 60_000;
const MAX_PASSKEYS = 10;

const b64u = {
  encode(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array<ArrayBuffer> {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

/** The relying party: the host the app was served from, and the page origin that must match it. */
function rp(req: Request) {
  const url = new URL(req.url);
  const rpID = url.hostname;
  const origin = req.headers.get('origin') ?? url.origin;
  let originHost = '';
  try {
    originHost = new URL(origin).hostname;
  } catch {
    // ignore
  }
  if (originHost !== rpID) throw new HttpError(400, 'bad_origin');
  return { rpID, origin };
}

async function saveChallenge(env: Env, kind: 'register' | 'login', challenge: string, accountId: string | null) {
  const id = randomId();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').bind(now),
    env.DB.prepare('INSERT INTO webauthn_challenges (id, account_id, kind, challenge, expires_at) VALUES (?, ?, ?, ?, ?)').bind(id, accountId, kind, challenge, now + CHALLENGE_MS),
  ]);
  return id;
}

/** Single use: the challenge is deleted as soon as it is read. */
async function takeChallenge(env: Env, id: unknown, kind: 'register' | 'login', accountId: string | null): Promise<string> {
  if (typeof id !== 'string' || id.length > 64) throw new HttpError(400, 'invalid_challenge');
  const row = await env.DB.prepare('SELECT account_id, kind, challenge, expires_at FROM webauthn_challenges WHERE id = ?').bind(id).first<{ account_id: string | null; kind: string; challenge: string; expires_at: number }>();
  await env.DB.prepare('DELETE FROM webauthn_challenges WHERE id = ?').bind(id).run();
  if (!row || row.kind !== kind || row.expires_at < Date.now() || (row.account_id ?? null) !== accountId) throw new HttpError(400, 'invalid_challenge');
  return row.challenge;
}

// ---------------- adding a passkey (signed in) ----------------
export async function registerOptions(req: Request, env: Env, accountId: string) {
  const { rpID } = rp(req);
  const existing = await env.DB.prepare('SELECT id, transports FROM passkeys WHERE account_id = ?').bind(accountId).all<{ id: string; transports: string }>();
  if (existing.results.length >= MAX_PASSKEYS) throw new HttpError(409, 'too_many_passkeys');
  const options = await generateRegistrationOptions({
    rpName: 'Home Tutor',
    rpID,
    // No email or name is ever sent: the passkey is labelled with the app name only.
    userName: 'Home Tutor account',
    userID: new TextEncoder().encode(accountId),
    attestationType: 'none',
    excludeCredentials: existing.results.map((p) => ({ id: p.id, transports: JSON.parse(p.transports) })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  const challengeId = await saveChallenge(env, 'register', options.challenge, accountId);
  return json({ challengeId, options });
}

export async function registerVerify(req: Request, env: Env, accountId: string) {
  const { rpID, origin } = rp(req);
  const body = await readJson(req);
  const expectedChallenge = await takeChallenge(env, body.challengeId, 'register', accountId);
  let result;
  try {
    result = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  } catch {
    throw new HttpError(400, 'passkey_failed');
  }
  if (!result.verified) throw new HttpError(400, 'passkey_failed');
  const cred = result.registrationInfo.credential;
  const label = typeof body.label === 'string' ? body.label.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
  const taken = await env.DB.prepare('SELECT 1 AS x FROM passkeys WHERE id = ?').bind(cred.id).first();
  if (taken) throw new HttpError(409, 'passkey_exists');
  await env.DB.prepare('INSERT INTO passkeys (id, account_id, public_key, counter, transports, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(cred.id, accountId, b64u.encode(cred.publicKey), cred.counter, JSON.stringify(cred.transports ?? []), label, Date.now())
    .run();
  return json({ id: cred.id }, 201);
}

export async function listPasskeys(env: Env, accountId: string) {
  const rows = await env.DB.prepare('SELECT id, label, created_at, last_used_at FROM passkeys WHERE account_id = ? ORDER BY created_at').bind(accountId).all<{ id: string; label: string; created_at: number; last_used_at: number | null }>();
  return json({ passkeys: rows.results.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at ?? undefined })) });
}

export async function deletePasskey(env: Env, accountId: string, id: string) {
  await env.DB.prepare('DELETE FROM passkeys WHERE id = ? AND account_id = ?').bind(id, accountId).run();
  return json({ ok: true });
}

// ---------------- signing in with a passkey ----------------
export async function loginOptions(req: Request, env: Env) {
  const { rpID } = rp(req);
  if (!(await rateLimit(env.DB, `passkey-ip:${clientIp(req)}`, 30, 3600))) throw new HttpError(429, 'rate_limited');
  // Discoverable credentials: the device offers its passkeys for this site, so no account hint.
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred', allowCredentials: [] });
  const challengeId = await saveChallenge(env, 'login', options.challenge, null);
  return json({ challengeId, options });
}

/** Returns the account id when the assertion is valid; the caller creates the session. */
export async function loginVerify(req: Request, env: Env): Promise<string> {
  const { rpID, origin } = rp(req);
  const body = await readJson(req);
  const expectedChallenge = await takeChallenge(env, body.challengeId, 'login', null);
  const credId = body.response?.id;
  if (typeof credId !== 'string' || credId.length > 1024) throw new HttpError(400, 'passkey_failed');
  const row = await env.DB.prepare('SELECT id, account_id, public_key, counter, transports FROM passkeys WHERE id = ?').bind(credId).first<{ id: string; account_id: string; public_key: string; counter: number; transports: string }>();
  if (!row) throw new HttpError(401, 'passkey_unknown');
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: row.id, publicKey: b64u.decode(row.public_key), counter: row.counter, transports: JSON.parse(row.transports) },
      requireUserVerification: false,
    });
  } catch {
    throw new HttpError(401, 'passkey_failed');
  }
  if (!result.verified) throw new HttpError(401, 'passkey_failed');
  await env.DB.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').bind(result.authenticationInfo.newCounter, Date.now(), row.id).run();
  return row.account_id;
}

export function deletePasskeyStmts(env: Env, accountId: string) {
  return [env.DB.prepare('DELETE FROM passkeys WHERE account_id = ?').bind(accountId), env.DB.prepare('DELETE FROM webauthn_challenges WHERE account_id = ?').bind(accountId)];
}

export const _test = { b64u };
