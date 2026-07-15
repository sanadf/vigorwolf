-- ============================================================================
--  VIGORWOLF — 0010: promo codes + global delivery control  (SAFE / ADDITIVE)
--  ----------------------------------------------------------------------------
--  Adds a go-forward promo-code system (kept separate from the legacy `coupons`
--  table so the existing coupon path is untouched), a key/value app_settings
--  table for the global delivery mode, a promo_code_uses ledger, and additive
--  reporting columns on `orders`.
--
--  Run ONCE on an existing database:
--    npm run db:promo:remote      (production)
--    npm run db:promo:local       (local dev)
--
--  NOTE: SQLite/D1 has no `ADD COLUMN IF NOT EXISTS`. The CREATE TABLE / CREATE
--  INDEX / INSERT OR IGNORE statements are idempotent, but the ALTER TABLE
--  statements at the bottom must run exactly once. If a re-run errors on a
--  duplicate column, that column already exists — it is safe to ignore.
-- ============================================================================

-- ---------- GLOBAL SETTINGS (key/value) -------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Delivery mode: 'normal' | 'free_all' | 'free_over_threshold'
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('delivery_mode', 'normal');
-- Minimum subtotal (JD) for free delivery when mode = 'free_over_threshold'
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('free_delivery_threshold', '0');

-- ---------- PROMO CODES -----------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT NOT NULL UNIQUE,          -- stored UPPERCASE, compared case-insensitively
  campaign_name       TEXT DEFAULT '',
  influencer_name     TEXT DEFAULT '',
  description         TEXT DEFAULT '',
  discount_type       TEXT NOT NULL DEFAULT 'percentage', -- percentage | fixed | free_delivery
  discount_value      REAL NOT NULL DEFAULT 0,        -- percent (0-100) or fixed JD; ignored for free_delivery
  active              INTEGER NOT NULL DEFAULT 1,     -- 0/1
  starts_at           TEXT DEFAULT '',                -- ISO date/time ('' = no start bound)
  expires_at          TEXT DEFAULT '',                -- ISO date/time ('' = no expiry)
  max_uses            INTEGER NOT NULL DEFAULT 0,     -- total usage limit (0 = unlimited)
  per_customer_limit  INTEGER NOT NULL DEFAULT 0,     -- per-email limit (0 = unlimited)
  min_order_amount    REAL NOT NULL DEFAULT 0,        -- minimum subtotal (JD)
  max_discount_amount REAL NOT NULL DEFAULT 0,        -- cap on discount (JD); 0 = no cap
  product_ids         TEXT NOT NULL DEFAULT '[]',     -- JSON array of product ids; [] = all products
  first_order_only    INTEGER NOT NULL DEFAULT 0,     -- 0/1: restrict to a customer's first order
  used_count          INTEGER NOT NULL DEFAULT 0,     -- successful uses (denormalized counter)
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active);

-- ---------- PROMO USAGE LEDGER ----------------------------------------------
-- One row per successful order that used a code. UNIQUE(order_id) guarantees a
-- given order can only ever record promo usage once (retry/refresh safe).
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_code_id        INTEGER NOT NULL,
  promo_code           TEXT NOT NULL,
  order_id             INTEGER NOT NULL UNIQUE,
  order_number         TEXT DEFAULT '',
  customer_email       TEXT DEFAULT '',
  discount_amount_jod  REAL NOT NULL DEFAULT 0,
  shipping_discount_jod REAL NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promo_uses_code_id ON promo_code_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_email ON promo_code_uses(customer_email);
CREATE INDEX IF NOT EXISTS idx_promo_uses_created ON promo_code_uses(created_at);

-- ---------- ORDERS: additive reporting columns ------------------------------
-- These snapshot the exact promo + delivery math used, so historical reports
-- stay accurate even if a code is later edited or deleted. Existing order
-- totals (subtotal, total, shipping_jd, ...) are left untouched.
ALTER TABLE orders ADD COLUMN promo_code_id INTEGER DEFAULT NULL;
ALTER TABLE orders ADD COLUMN promo_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN campaign_name TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN influencer_name TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN discount_type TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN discount_value REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_amount_jod REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN subtotal_before_discount_jod REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_before_discount_jod REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_discount_jod REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN final_shipping_jod REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN final_total_jod REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN promo_applied_at TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_orders_promo_code_id ON orders(promo_code_id);
