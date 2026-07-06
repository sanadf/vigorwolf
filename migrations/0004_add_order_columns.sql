-- ============================================================================
--  VIGORWOLF — 0004 (REFERENCE ONLY — usually NOT needed)
--  ----------------------------------------------------------------------------
--  These ADD COLUMN statements are already part of 0001_init.sql. You only need
--  them if you are upgrading a VERY OLD database whose `orders` table predates
--  the loyalty/coupon/shipping columns.
--
--  SQLite/D1 has NO "ADD COLUMN IF NOT EXISTS", so running this whole file will
--  abort on the first column that already exists. Therefore:
--
--  1) First check what your orders table already has:
--       npx wrangler d1 execute vigorwolf-db --remote \
--         --command "SELECT name FROM pragma_table_info('orders');"
--
--  2) Then run ONLY the lines below for columns that are MISSING, one at a time:
--       npx wrangler d1 execute vigorwolf-db --remote \
--         --command "ALTER TABLE orders ADD COLUMN shipping_jd REAL NOT NULL DEFAULT 0;"
--
--  Do NOT run this file with --file if any of these columns already exist.
-- ============================================================================

ALTER TABLE orders ADD COLUMN coupon_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN coupon_discount_jd REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_redeemed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_discount_jd REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_jd REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN total_after_discounts REAL NOT NULL DEFAULT 0;
