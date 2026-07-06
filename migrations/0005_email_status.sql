-- ============================================================================
--  VIGORWOLF — 0005: add orders.email_status (notification result)
--  Safe additive change. Run ONCE on an existing database that was created
--  before this column existed:
--    npm run db:email-status:remote     (production)
--    npm run db:email-status:local      (local dev)
--  Fresh databases (from 0001_init.sql) already include this column — do NOT
--  run this on a fresh DB or it will error with "duplicate column name".
-- ============================================================================
ALTER TABLE orders ADD COLUMN email_status TEXT DEFAULT '';
