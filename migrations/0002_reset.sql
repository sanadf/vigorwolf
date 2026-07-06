-- Danger: drops all VIGORWOLF tables. Used by `npm run db:reset:local`.
DROP TABLE IF EXISTS loyalty_transactions;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS drops;
DROP TABLE IF EXISTS email_signups;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admin_users;
