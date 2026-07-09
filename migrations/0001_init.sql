-- ============================================================================
--  VIGORWOLF — D1 schema + seed  (migration 0001)
--  Run:  npm run db:local     (local dev database)
--        npm run db:remote    (production Cloudflare D1)
-- ============================================================================

-- ---------- ADMIN USERS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,            -- format: pbkdf2$iterations$saltHex$hashHex
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- CUSTOMER USERS (real accounts + loyalty) ------------------------
-- One shared, persistent account per email. Password is PBKDF2-hashed (never
-- plaintext). Email is stored normalized (trim + lowercase) and is UNIQUE, so
-- the same account works across every device. Loyalty points live here too.
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,          -- normalized (lowercase, trimmed)
  name           TEXT DEFAULT '',
  password       TEXT DEFAULT '',               -- pbkdf2$iter$salt$hash ('' = order-only, no login yet)
  phone          TEXT DEFAULT '',
  city           TEXT DEFAULT '',
  address        TEXT DEFAULT '',
  points_balance INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- PRODUCTS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  price       REAL NOT NULL DEFAULT 0,
  sale_price  REAL,                    -- nullable; when set + > 0 => on sale
  category    TEXT NOT NULL DEFAULT 'T-Shirts',
  description TEXT DEFAULT '',
  material    TEXT DEFAULT '',
  fit         TEXT DEFAULT '',
  care        TEXT DEFAULT '',
  gsm         TEXT DEFAULT '',         -- e.g. "240 GSM"
  model_info  TEXT DEFAULT '',         -- e.g. "Model is 1.80m / wears M"
  colors      TEXT DEFAULT '[]',       -- JSON array e.g. ["Black"]
  sizes       TEXT DEFAULT '[]',       -- JSON array e.g. ["S","M","L","XL"]
  stock       INTEGER DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',  -- active|new_drop|low_stock|sold_out|coming_soon
  drop_name   TEXT DEFAULT 'Drop One',
  featured    INTEGER NOT NULL DEFAULT 0,      -- 0/1
  hidden      INTEGER NOT NULL DEFAULT 0,      -- 0/1 (admin can hide)
  image_url   TEXT DEFAULT '',         -- legacy main image (mirrors image_1)
  image_1     TEXT DEFAULT '',         -- primary product image
  image_2     TEXT DEFAULT '',         -- secondary / hover image
  gallery     TEXT DEFAULT '[]',       -- JSON array of image URLs (legacy)
  stock_s     INTEGER NOT NULL DEFAULT 0,      -- per-size inventory
  stock_m     INTEGER NOT NULL DEFAULT 0,
  stock_l     INTEGER NOT NULL DEFAULT 0,
  stock_xl    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- ORDERS ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number   TEXT NOT NULL UNIQUE,
  customer_name  TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT NOT NULL,
  city           TEXT NOT NULL,
  address        TEXT NOT NULL,
  notes          TEXT DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  status         TEXT NOT NULL DEFAULT 'Pending', -- Pending|Confirmed|Processing|Shipped|Delivered|Cancelled
  subtotal       REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,          -- final total after all discounts
  user_email     TEXT DEFAULT '',      -- links order to a user account (optional)
  -- discounts / loyalty
  coupon_code           TEXT DEFAULT '',
  coupon_discount_jd    REAL NOT NULL DEFAULT 0,
  points_redeemed       INTEGER NOT NULL DEFAULT 0,
  points_discount_jd    REAL NOT NULL DEFAULT 0,
  points_earned         INTEGER NOT NULL DEFAULT 0,
  shipping_jd           REAL NOT NULL DEFAULT 0,
  total_after_discounts REAL NOT NULL DEFAULT 0,
  email_status   TEXT DEFAULT '',          -- notification result: sent:resend | failed:... | skipped
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  product_id INTEGER,
  name       TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0,
  size       TEXT DEFAULT '',
  color      TEXT DEFAULT '',
  qty        INTEGER NOT NULL DEFAULT 1,
  image_url  TEXT DEFAULT '',
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ---------- DROPS -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS drops (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT DEFAULT '',
  launch_date    TEXT DEFAULT '',
  countdown_date TEXT DEFAULT '',      -- ISO date used by countdown timer
  status         TEXT NOT NULL DEFAULT 'Coming Soon', -- Coming Soon|Live|Sold Out
  hero_text      TEXT DEFAULT '',
  featured_ids   TEXT DEFAULT '[]',    -- JSON array of product ids
  is_current     INTEGER NOT NULL DEFAULT 0,          -- the active drop shown on home/drop pages
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- EMAIL SIGNUPS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS email_signups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  source     TEXT DEFAULT 'site',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- CONTACT MESSAGES ------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- PASSWORD RESET TOKENS -------------------------------------------
-- Only the SHA-256 hash of each reset token is stored (never the raw token).
-- Tokens expire (see /api/auth/forgot) and are deleted after a successful reset.
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,            -- ISO timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

-- ---------- LOYALTY TRANSACTIONS --------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  order_id   INTEGER,
  type       TEXT NOT NULL,            -- earned | redeemed | admin_adjustment
  points     INTEGER NOT NULL DEFAULT 0,   -- signed: + earned/added, - redeemed/removed
  jd_value   REAL NOT NULL DEFAULT 0,
  note       TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- COUPONS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL DEFAULT 'percentage', -- percentage | fixed
  value            REAL NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  min_order_amount REAL NOT NULL DEFAULT 0,
  max_uses         INTEGER NOT NULL DEFAULT 0,   -- 0 = unlimited
  used_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TEXT DEFAULT '',              -- '' = no expiry (ISO date)
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
--  SEED DATA
-- ============================================================================

-- Admin account.  Email: vigorwolf1@gmail.com   Password: VigorWolfAdmin123
-- To change: run `npm run admin:reset:remote -- you@brand.com "NewPass"`.
INSERT OR IGNORE INTO admin_users (email, password) VALUES
('vigorwolf1@gmail.com',
 'pbkdf2$100000$c124ccfa9f0928628858104ff789455e$120bdc47b47ee4b6e01fe73a14cf59b0401ff561939c5b8ea9a82f6237369fb2');

-- Products -------------------------------------------------------------------
INSERT OR IGNORE INTO products
(name, slug, price, sale_price, category, description, material, fit, care, gsm, model_info, colors, sizes, stock, status, drop_name, featured, hidden, image_url, image_1, image_2, gallery, stock_s, stock_m, stock_l, stock_xl)
VALUES
('VIGORWOLF Redline Tee', 'vigorwolf-redline-tee', 27.99, NULL, 'T-Shirts',
 'A red-accent tee designed for sharp streetwear presence. Cut heavy, printed clean — built to be worn hard and read loud.',
 '100% combed cotton', 'Regular streetwear fit', 'Machine wash cold, inside out. Do not tumble dry. Do not iron print.',
 '240 GSM', 'Model is 1.80m / 78kg, wears size M',
 '["Black"]', '["S","M","L","XL"]', 13, 'low_stock', 'Drop One', 1, 0,
 '/assets/media/redline-tee.jpg', '/assets/media/redline-tee.jpg', '/assets/media/hero.jpg',
 '["/assets/media/redline-tee.jpg"]', 4, 6, 3, 0),

('VIGORWOLF Oversized Tanktop', 'vigorwolf-oversized-tanktop', 29.99, NULL, 'T-Shirts',
 'Oversized streetwear fit with a bold VIGORWOLF claw graphic. Dropped shoulders, open cut — made for the grind and the walk home.',
 '100% heavyweight cotton', 'Oversized drop-shoulder fit', 'Machine wash cold, inside out. Hang dry. Do not iron print.',
 '260 GSM', 'Model is 1.82m / 84kg, wears size L',
 '["Black"]', '["S","M","L","XL"]', 45, 'new_drop', 'Drop One', 1, 0,
 '/assets/media/tanktop.jpg', '/assets/media/tanktop.jpg', '/assets/media/hero.jpg',
 '["/assets/media/tanktop.jpg"]', 12, 15, 10, 8),

('VIGORWOLF Jersey', 'vigorwolf-jersey', 49.99, NULL, 'Hoodies',
 'Heavyweight jersey made for cold nights and sharp energy. Numbered back, matte finish, zero noise. The Pack uniform.',
 'Premium poly-cotton blend', 'Relaxed athletic fit', 'Machine wash cold. Hang dry. Do not bleach.',
 '300 GSM', 'Model is 1.85m / 88kg, wears size L',
 '["Black"]', '["S","M","L","XL"]', 0, 'coming_soon', 'Drop One', 1, 0,
 '/assets/media/jersey.jpg', '/assets/media/jersey.jpg', '/assets/media/hero.jpg',
 '["/assets/media/jersey.jpg"]', 0, 0, 0, 0);

-- Example coupon -------------------------------------------------------------
INSERT OR IGNORE INTO coupons (code, type, value, active, min_order_amount, max_uses, expires_at)
VALUES ('PACK10', 'percentage', 10, 1, 20, 0, '');

-- Drop One -------------------------------------------------------------------
INSERT OR IGNORE INTO drops
(name, slug, description, launch_date, countdown_date, status, hero_text, featured_ids, is_current)
VALUES
('Drop One', 'drop-one',
 'The first VIGORWOLF release. Limited units. Once it is gone, it is gone. The Pack moves first.',
 'Out Now', '', 'Live',
 'Drop One — Out Now', '[1,2,3]', 1);
