/** Password hashing (PBKDF2-SHA256 via WebCrypto), tokens and constant-time comparison. */
import { randomBytes, sha256Hex, toHex } from '../../src/core/crypto';

const enc = new TextEncoder();

export const DEFAULT_ITERATIONS = 100_000; // the Workers WebCrypto maximum for PBKDF2

export async function pbkdf2(password: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string, iterations: number) {
  const salt = toHex(randomBytes(16));
  return { salt, iterations, hash: await pbkdf2(password, salt, iterations) };
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function emailHash(email: string): string {
  return sha256Hex(`home-tutor:email:${email.trim().toLowerCase()}`);
}

export function newToken(): string {
  return toHex(randomBytes(32));
}

export function tokenHash(token: string): string {
  return sha256Hex(`home-tutor:session:${token}`);
}

export function secretHash(kind: string, secret: string): string {
  return sha256Hex(`home-tutor:${kind}:${secret}`);
}
