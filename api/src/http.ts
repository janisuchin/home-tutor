/** Shared HTTP helpers for the Worker API: JSON responses, errors, body parsing and rate limits. */

const MAX_BODY = 1_000_000;

export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown[]>;
}
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface Env {
  DB: D1Like;
  ASSETS?: { fetch(req: Request): Promise<Response> };
  PASSWORD_ITERATIONS?: string;
  AI_TUTOR_ENABLED?: string;
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      // Native apps call the API cross-origin with a bearer token (no cookies), so * is safe.
      'access-control-allow-origin': '*',
    },
  });
export const err = (status: number, error: string) => json({ error }, status);

export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

/** Fixed-window rate limit stored in D1. Returns true when the call is allowed. */
export async function rateLimit(db: D1Like, key: string, limit: number, windowSec: number, now = Date.now()): Promise<boolean> {
  const row = await db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').bind(key).first<{ window_start: number; count: number }>();
  const windowStart = now - (now % (windowSec * 1000));
  if (!row || row.window_start !== windowStart) {
    await db.prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)').bind(key, windowStart).run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export async function readJson(req: Request): Promise<any> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'too_large');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

