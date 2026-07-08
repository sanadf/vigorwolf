-- ============================================================================
--  VIGORWOLF — 0008: password reset tokens (forgot / reset password)
--  ----------------------------------------------------------------------------
--  SAFE + ADDITIVE. Creates the password_resets table. Only the SHA-256 hash of
--  each token is stored; tokens expire and are cleared after a successful reset.
--
--  Run ONCE on an existing database:
--    npm run db:resets:remote      (production)
--    npm run db:resets:local       (local dev)
--
--  Idempotent (IF NOT EXISTS) — safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
