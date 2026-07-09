-- ============================================================================
--  VIGORWOLF — 0009: add canonical `password_hash` column to users
--  ----------------------------------------------------------------------------
--  Production's `users` table only has a legacy `password` column (added by
--  migration 0007, before this codebase standardized on `password_hash`). The
--  app code now reads/writes `password_hash` everywhere. This migration:
--    1. Adds `password_hash` (additive — SQLite/D1 has no ADD COLUMN IF NOT
--       EXISTS, so this file must only ever be run once per database).
--    2. Backfills it from the legacy `password` column for any existing
--       accounts, so nobody's login breaks.
--
--  SAFE. Does NOT drop the users table, does NOT delete users/orders/loyalty,
--  does NOT drop the legacy `password` column (left in place, unused).
--
--  Run ONCE on an existing database:
--    npm run db:fix-auth:remote      (production)
--    npm run db:fix-auth:local       (local dev, if it also has this issue)
--
--  Fresh databases (from 0001_init.sql) already include password_hash — do
--  NOT run this on a fresh DB (SQLite has no ADD COLUMN IF NOT EXISTS).
-- ============================================================================

ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT '';

UPDATE users
SET password_hash = password
WHERE (password_hash IS NULL OR password_hash = '')
  AND password IS NOT NULL AND password != '';
