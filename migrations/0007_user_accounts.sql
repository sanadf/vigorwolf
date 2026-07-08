-- ============================================================================
--  VIGORWOLF — 0007: real customer accounts on the users table
--  ----------------------------------------------------------------------------
--  SAFE + ADDITIVE. Adds password + contact columns so customers have ONE real
--  account (in D1) that works across all devices, instead of a per-browser
--  localStorage account. No data is dropped; existing rows (created by orders /
--  loyalty) keep their points and simply gain empty columns until the customer
--  registers, which "claims" the row by setting a password.
--
--  Run ONCE on an existing database:
--    npm run db:accounts:remote      (production)
--    npm run db:accounts:local       (local dev)
--
--  Fresh databases (from 0001_init.sql) already include these columns — do NOT
--  run this on a fresh DB (SQLite has no ADD COLUMN IF NOT EXISTS).
-- ============================================================================

ALTER TABLE users ADD COLUMN password TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN phone    TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN city     TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN address  TEXT DEFAULT '';
