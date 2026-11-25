/** A tiny D1-compatible wrapper over Node's built-in SQLite, for tests and the local server. */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { D1Like, D1Stmt } from '../src/index';

class Stmt implements D1Stmt {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private values: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1Stmt {
    return new Stmt(this.db, this.sql, values.map((v) => (v === undefined ? null : v)));
  }
  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...(this.values as any[]));
    return (row as T) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...(this.values as any[])) as T[] };
  }
  async run(): Promise<unknown> {
    return this.db.prepare(this.sql).run(...(this.values as any[]));
  }
  runSync() {
    return this.db.prepare(this.sql).run(...(this.values as any[]));
  }
}

export function createTestDb(): D1Like {
  const db = new DatabaseSync(':memory:');
  // Apply every migration in order, exactly as `wrangler d1 migrations apply` does.
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(dir, f), 'utf8'));
  return {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: D1Stmt[]) {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => (s as Stmt).runSync());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
