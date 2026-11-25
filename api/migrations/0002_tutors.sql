-- Round 2: tutor accounts. Additive only (the live database already holds 0001).
-- A parent invites a tutor with a one-time code; the tutor signs in with their own account and
-- sees and updates only the children the parent shared. Only hashes of invite codes are stored.

CREATE TABLE IF NOT EXISTS tutor_links (
  id TEXT PRIMARY KEY,
  parent_account_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,      -- SHA-256 of the invite code; cleared to a random value once accepted
  label TEXT NOT NULL DEFAULT '',      -- what the parent calls this tutor, e.g. "Maths tutor"
  family_label TEXT NOT NULL DEFAULT '', -- what the tutor sees, e.g. the family name
  child_ids TEXT NOT NULL,             -- JSON array of the shared child ids
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,         -- the invite code stops working after this (accepted links stay)
  accepted_at INTEGER,
  tutor_account_id TEXT,
  removed_at INTEGER
);
CREATE INDEX IF NOT EXISTS tutor_links_parent ON tutor_links (parent_account_id);
CREATE INDEX IF NOT EXISTS tutor_links_tutor ON tutor_links (tutor_account_id);
