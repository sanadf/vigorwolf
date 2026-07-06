-- ============================================================================
--  VIGORWOLF — 0003 "ensure loyalty + coupons" (SAFE / IDEMPOTENT)
--  ----------------------------------------------------------------------------
--  IMPORTANT: The full loyalty/coupon/shipping schema now lives in
--  0001_init.sql. If you seeded your database with `npm run db:remote`
--  (or db:local), you ALREADY HAVE everything and do NOT need this file.
--
--  This migration is now only a safety net: it re-creates the loyalty/coupon
--  TABLES if they are somehow missing, and re-seeds the sample coupon.
--  Every statement uses IF NOT EXISTS / OR IGNORE, so it can be run any number
--  of times without error and without touching existing data.
--
--  Run (optional, safe):
--    npm run db:upgrade:remote     /     npm run db:upgrade:local
--
--  NOTE ON COLUMNS: SQLite/D1 does NOT support
--  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so we do NOT ALTER here (that is
--  what caused the "duplicate column name: coupon_code" error). The order
--  columns are part of 0001_init.sql. If you are migrating a very old database
--  that predates those columns, see migrations/0004_add_order_columns.sql and
--  run only the lines your schema is actually missing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT DEFAULT '',
  points_balance INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  order_id   INTEGER,
  type       TEXT NOT NULL,
  points     INTEGER NOT NULL DEFAULT 0,
  jd_value   REAL NOT NULL DEFAULT 0,
  note       TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL DEFAULT 'percentage',
  value            REAL NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  min_order_amount REAL NOT NULL DEFAULT 0,
  max_uses         INTEGER NOT NULL DEFAULT 0,
  used_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TEXT DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO coupons (code, type, value, active, min_order_amount, max_uses, expires_at)
VALUES ('PACK10', 'percentage', 10, 1, 20, 0, '');
