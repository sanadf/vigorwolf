-- ============================================================================
--  VIGORWOLF — 0006: two product images + per-size stock
--  ----------------------------------------------------------------------------
--  SAFE + ADDITIVE. Does NOT drop the products table and does NOT delete any
--  products. Adds the new columns, then backfills existing rows so nothing
--  goes out of stock:
--    - image_1  <- existing image_url
--    - stock_s/m/l/xl <- existing total `stock` (each size seeded with it)
--
--  Run ONCE on an existing database:
--    npm run db:product-inventory:remote     (production)
--    npm run db:product-inventory:local      (local dev)
--
--  Fresh databases (from 0001_init.sql) already include these columns — do NOT
--  run this on a fresh DB (SQLite has no ADD COLUMN IF NOT EXISTS, so re-running
--  errors with "duplicate column name"). See migration notes in README.
-- ============================================================================

ALTER TABLE products ADD COLUMN image_1  TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN image_2  TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN stock_s  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN stock_m  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN stock_l  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN stock_xl INTEGER NOT NULL DEFAULT 0;

-- Backfill primary image from the legacy image_url.
UPDATE products SET image_1 = image_url
  WHERE (image_1 IS NULL OR image_1 = '') AND image_url IS NOT NULL AND image_url != '';

-- Seed each size's stock from the old total `stock` so existing products stay
-- purchasable. (Only touches rows where the new size columns are still 0.)
UPDATE products
  SET stock_s = stock, stock_m = stock, stock_l = stock, stock_xl = stock
  WHERE stock_s = 0 AND stock_m = 0 AND stock_l = 0 AND stock_xl = 0 AND stock > 0;
