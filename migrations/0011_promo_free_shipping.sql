-- ============================================================================
--  VIGORWOLF — 0011: add independent "free shipping" flag to promo codes
--  ----------------------------------------------------------------------------
--  SAFE + ADDITIVE. Lets a percentage/fixed promo code ALSO grant free delivery
--  (e.g. an influencer code = 10% off + free shipping). Independent of
--  discount_type; a discount_type='free_delivery' code is free shipping anyway.
--
--  Run ONCE on an existing database:
--    npm run db:promo-ship:remote      (production)
--    npm run db:promo-ship:local       (local dev)
--
--  SQLite/D1 has no ADD COLUMN IF NOT EXISTS — run once. A duplicate-column
--  error on re-run just means it is already applied and is safe to ignore.
-- ============================================================================

ALTER TABLE promo_codes ADD COLUMN free_shipping INTEGER NOT NULL DEFAULT 0;
