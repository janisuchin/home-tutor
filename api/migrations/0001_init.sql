-- Home Tutor D1 schema. Minimal data: no plain email addresses, no names beyond the child's
-- first name/nickname inside synced records, and everything deletable by the account owner.

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,     -- SHA-256 of the normalised email; the address itself is never stored
  pw_hash TEXT NOT NULL,               -- PBKDF2-SHA256
  pw_salt TEXT NOT NULL,
  pw_iter INTEGER NOT NULL,
  recovery_hash TEXT NOT NULL,         -- SHA-256 of the one-time recovery key
  consent_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0       -- sync sequence counter
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);

CREATE TABLE IF NOT EXISTS records (
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  child_id TEXT,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (account_id, kind, id)
);
CREATE INDEX IF NOT EXISTS records_seq ON records (account_id, seq);
CREATE INDEX IF NOT EXISTS records_child ON records (account_id, child_id);

CREATE TABLE IF NOT EXISTS progress_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS keys_account ON progress_keys (account_id);

CREATE TABLE IF NOT EXISTS passport_snapshots (
  account_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, child_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
