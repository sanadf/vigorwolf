-- ============================================================================
--  VIGORWOLF — upgrade an EXISTING database with loyalty + coupons (0003)
--  Safe to run once on a database created before these features existed.
--  Run:  npm run db:upgrade:local   /   npm run db:upgrade:remote
--  (A fresh `npm run db:remote` already includes everything — this is only for
--   databases that were seeded from the original 0001 schema.)
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

-- New order columns (SQLite ignores errors only if you guard; run once).
ALTER TABLE orders ADD COLUMN coupon_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN coupon_discount_jd REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_redeemed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_discount_jd REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN total_after_discounts REAL NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO coupons (code, type, value, active, min_order_amount, max_uses, expires_at)
VALUES ('PACK10', 'percentage', 10, 1, 20, 0, '');
