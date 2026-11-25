-- Round 2: passkeys (WebAuthn) as an optional extra sign-in. Additive only.
-- Only public keys are stored; the private key never leaves the person's device.

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,                 -- credential id (base64url)
  account_id TEXT NOT NULL,
  public_key TEXT NOT NULL,            -- COSE public key (base64url)
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS passkeys_account ON passkeys (account_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  account_id TEXT,                     -- set for registration, empty for sign-in
  kind TEXT NOT NULL,                  -- 'register' | 'login'
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
