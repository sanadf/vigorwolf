#!/usr/bin/env node
/**
 * VIGORWOLF — promo-code + delivery Phase 1 tests.
 *
 * Runs the REAL server-side logic (functions/api/_lib/promo.js + settings.js)
 * against Node's built-in sqlite via a tiny D1-compatible shim, and applies the
 * REAL migration 0010 to a legacy-shaped orders table. No network/dev server.
 *
 * Run: node scripts/test-promo.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { validateAndComputePromo, normalizeCode } from "../functions/api/_lib/promo.js";
import { applyGlobalDelivery } from "../functions/api/_lib/settings.js";
import { round2 } from "../functions/api/_lib/loyalty.js";

let pass = 0, fail = 0;
const ok = (n) => { console.log(`  ✅ ${n}`); pass++; };
const no = (n, d) => { console.log(`  ❌ ${n} — ${d}`); fail++; };

// ---- Minimal D1-compatible shim over node:sqlite ---------------------------
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
  }
}
class D1 { constructor(db) { this.db = db; } prepare(sql) { return new Stmt(this.db, sql); } }

const sqlite = new DatabaseSync(":memory:");
const env = { DB: new D1(sqlite) };

// ---- Schema: legacy orders (no promo cols) + products, then run 0010 -------
sqlite.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL, sale_price REAL, hidden INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0, stock_s INTEGER DEFAULT 0, stock_m INTEGER DEFAULT 0, stock_l INTEGER DEFAULT 0, stock_xl INTEGER DEFAULT 0);
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE, email TEXT, status TEXT DEFAULT 'Pending',
    subtotal REAL DEFAULT 0, total REAL DEFAULT 0, shipping_jd REAL DEFAULT 0);
`);
sqlite.prepare("INSERT INTO products (id,name,price,sale_price,stock_m) VALUES (1,'Tee',30,NULL,100)").run();
sqlite.prepare("INSERT INTO products (id,name,price,sale_price,stock_m) VALUES (2,'Hoodie',50,NULL,100)").run();

// Apply the real migration 0010 (create tables + alter orders).
const mig = readFileSync(new URL("../migrations/0010_promo_and_delivery.sql", import.meta.url), "utf8");
// Strip inline + full-line `--` comments (some contain a ';') before splitting.
const migClean = mig.split("\n").map((l) => { const i = l.indexOf("--"); return i >= 0 ? l.slice(0, i) : l; }).join("\n");
for (const stmt of migClean.split(";").map((s) => s.trim()).filter(Boolean)) {
  sqlite.exec(stmt + ";");
}

// migration sanity
{
  const cols = sqlite.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  cols.includes("promo_code_id") && cols.includes("final_total_jod")
    ? ok("migration 0010 adds promo columns to legacy orders") : no("migration adds order cols", cols.join(","));
  const t = sqlite.prepare("SELECT COUNT(*) AS n FROM app_settings").get().n;
  t >= 2 ? ok("app_settings seeded (delivery_mode + threshold)") : no("app_settings seed", `n=${t}`);
}

// ---- helpers ----
const items1 = [{ productId: 1, price: 30, qty: 1 }]; // subtotal 30
const items2 = [{ productId: 1, price: 30, qty: 1 }, { productId: 2, price: 50, qty: 1 }]; // 80
function insertPromo(row) {
  const d = {
    code: "X", campaign_name: "", influencer_name: "", description: "", discount_type: "percentage",
    discount_value: 0, active: 1, starts_at: "", expires_at: "", max_uses: 0, per_customer_limit: 0,
    min_order_amount: 0, max_discount_amount: 0, product_ids: "[]", first_order_only: 0, used_count: 0, ...row,
  };
  sqlite.prepare(`INSERT INTO promo_codes
    (code,campaign_name,influencer_name,description,discount_type,discount_value,active,starts_at,expires_at,
     max_uses,per_customer_limit,min_order_amount,max_discount_amount,product_ids,first_order_only,used_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    d.code, d.campaign_name, d.influencer_name, d.description, d.discount_type, d.discount_value, d.active,
    d.starts_at, d.expires_at, d.max_uses, d.per_customer_limit, d.min_order_amount, d.max_discount_amount,
    d.product_ids, d.first_order_only, d.used_count);
}
const iso = (deltaMs) => new Date(Date.now() + deltaMs).toISOString();

(async () => {
  console.log("\nPromo + delivery tests\n");

  // 1) valid percentage
  insertPromo({ code: "SAVE10", discount_type: "percentage", discount_value: 10 });
  let r = await validateAndComputePromo(env, { code: "save10", subtotal: 30, items: items1, email: "a@x.com" });
  r.valid && r.discountAmount === 3 ? ok("valid percentage code (10% of 30 = 3)") : no("percentage", JSON.stringify(r));

  // 2) valid fixed JOD
  insertPromo({ code: "MINUS5", discount_type: "fixed", discount_value: 5 });
  r = await validateAndComputePromo(env, { code: "MINUS5", subtotal: 30, items: items1, email: "a@x.com" });
  r.valid && r.discountAmount === 5 ? ok("valid fixed-JOD code (-5)") : no("fixed", JSON.stringify(r));

  // 3) free delivery
  insertPromo({ code: "FREESHIP", discount_type: "free_delivery" });
  r = await validateAndComputePromo(env, { code: "FREESHIP", subtotal: 30, items: items1, email: "a@x.com" });
  r.valid && r.freeDelivery && r.discountAmount === 0 ? ok("free-delivery code sets freeDelivery, 0 item discount") : no("free_delivery", JSON.stringify(r));

  // 4) mixed case + surrounding spaces
  r = await validateAndComputePromo(env, { code: "  save10  ", subtotal: 30, items: items1, email: "a@x.com" });
  r.valid && r.discountAmount === 3 ? ok("case/space-insensitive code match") : no("normalize", JSON.stringify(r));
  normalizeCode("  save10 ") === "SAVE10" ? ok("normalizeCode trims + uppercases") : no("normalizeCode", normalizeCode("  save10 "));

  // 5) invalid code
  r = await validateAndComputePromo(env, { code: "NOPE", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("invalid code rejected") : no("invalid", JSON.stringify(r));

  // 6) inactive
  insertPromo({ code: "OFF", active: 0, discount_type: "percentage", discount_value: 10 });
  r = await validateAndComputePromo(env, { code: "OFF", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("inactive code rejected") : no("inactive", JSON.stringify(r));

  // 7) expired
  insertPromo({ code: "OLD", discount_type: "percentage", discount_value: 10, expires_at: iso(-1000) });
  r = await validateAndComputePromo(env, { code: "OLD", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("expired code rejected") : no("expired", JSON.stringify(r));

  // 8) not yet active
  insertPromo({ code: "SOON", discount_type: "percentage", discount_value: 10, starts_at: iso(60000) });
  r = await validateAndComputePromo(env, { code: "SOON", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("not-yet-active code rejected") : no("not-yet-active", JSON.stringify(r));

  // 9) minimum order requirement
  insertPromo({ code: "MIN50", discount_type: "percentage", discount_value: 10, min_order_amount: 50 });
  r = await validateAndComputePromo(env, { code: "MIN50", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("below-minimum rejected") : no("min order", JSON.stringify(r));
  r = await validateAndComputePromo(env, { code: "MIN50", subtotal: 80, items: items2, email: "a@x.com" });
  r.valid && r.discountAmount === 8 ? ok("at/above minimum accepted") : no("min ok", JSON.stringify(r));

  // 10) max discount cap
  insertPromo({ code: "BIG", discount_type: "percentage", discount_value: 50, max_discount_amount: 10 });
  r = await validateAndComputePromo(env, { code: "BIG", subtotal: 80, items: items2, email: "a@x.com" });
  r.valid && r.discountAmount === 10 ? ok("max discount cap enforced (50% of 80 capped to 10)") : no("cap", JSON.stringify(r));

  // 11) fixed discount cannot exceed subtotal (no negative)
  insertPromo({ code: "HUGE", discount_type: "fixed", discount_value: 999 });
  r = await validateAndComputePromo(env, { code: "HUGE", subtotal: 30, items: items1, email: "a@x.com" });
  r.valid && r.discountAmount === 30 ? ok("fixed discount clamped to subtotal (no negative total)") : no("negative guard", JSON.stringify(r));

  // 12) product-restricted
  insertPromo({ code: "HOODIE", discount_type: "percentage", discount_value: 10, product_ids: "[2]" });
  r = await validateAndComputePromo(env, { code: "HOODIE", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("product-restricted rejected when eligible item absent") : no("restrict reject", JSON.stringify(r));
  r = await validateAndComputePromo(env, { code: "HOODIE", subtotal: 80, items: items2, email: "a@x.com" });
  r.valid && r.discountAmount === 5 ? ok("product-restricted discounts only eligible item (10% of 50 = 5)") : no("restrict apply", JSON.stringify(r));

  // 13) total usage limit reached
  insertPromo({ code: "LIMIT1", discount_type: "fixed", discount_value: 5, max_uses: 1, used_count: 1 });
  r = await validateAndComputePromo(env, { code: "LIMIT1", subtotal: 30, items: items1, email: "a@x.com" });
  !r.valid ? ok("exhausted (max_uses) code rejected") : no("usage limit", JSON.stringify(r));

  // 14) per-customer limit reached
  insertPromo({ code: "ONCE", discount_type: "fixed", discount_value: 5, per_customer_limit: 1 });
  const onceId = sqlite.prepare("SELECT id FROM promo_codes WHERE code='ONCE'").get().id;
  sqlite.prepare("INSERT INTO promo_code_uses (promo_code_id,promo_code,order_id,customer_email) VALUES (?,?,?,?)")
    .run(onceId, "ONCE", 9001, "repeat@x.com");
  r = await validateAndComputePromo(env, { code: "ONCE", subtotal: 30, items: items1, email: "repeat@x.com" });
  !r.valid ? ok("per-customer limit rejected for repeat email") : no("per-customer", JSON.stringify(r));
  r = await validateAndComputePromo(env, { code: "ONCE", subtotal: 30, items: items1, email: "fresh@x.com" });
  r.valid ? ok("per-customer limit allows a different email") : no("per-customer other", JSON.stringify(r));

  // 15) first-order-only
  insertPromo({ code: "FIRST", discount_type: "fixed", discount_value: 5, first_order_only: 1 });
  sqlite.prepare("INSERT INTO orders (order_number,email,status) VALUES ('VW-OLD','returning@x.com','Delivered')").run();
  r = await validateAndComputePromo(env, { code: "FIRST", subtotal: 30, items: items1, email: "returning@x.com" });
  !r.valid ? ok("first-order-only rejected for returning customer") : no("first-order reject", JSON.stringify(r));
  r = await validateAndComputePromo(env, { code: "FIRST", subtotal: 30, items: items1, email: "brandnew@x.com" });
  r.valid ? ok("first-order-only accepted for new customer") : no("first-order accept", JSON.stringify(r));

  // 16) global delivery modes
  let d = await applyGlobalDelivery(env, 3, 80);
  d.fee === 3 ? ok("normal delivery keeps governorate fee") : no("normal delivery", JSON.stringify(d));
  sqlite.prepare("UPDATE app_settings SET value='free_all' WHERE key='delivery_mode'").run();
  d = await applyGlobalDelivery(env, 3, 80);
  d.fee === 0 ? ok("global free_all mode -> 0 delivery") : no("free_all", JSON.stringify(d));
  sqlite.prepare("UPDATE app_settings SET value='free_over_threshold' WHERE key='delivery_mode'").run();
  sqlite.prepare("UPDATE app_settings SET value='50' WHERE key='free_delivery_threshold'").run();
  const below = await applyGlobalDelivery(env, 3, 30);
  const above = await applyGlobalDelivery(env, 3, 80);
  below.fee === 3 && above.fee === 0 ? ok("free_over_threshold: charges below, free at/above") : no("threshold", JSON.stringify({ below, above }));
  sqlite.prepare("UPDATE app_settings SET value='normal' WHERE key='delivery_mode'").run();

  // 17) simulate order pricing pipeline (mirror of orders/create.js) + effects
  function priceOrder({ subtotal, promoDiscount = 0, freeDelivery = false, baseShipping = 3, points = 0 }) {
    const orderDiscount = round2(Math.min(promoDiscount, subtotal));
    const afterDiscount = round2(Math.max(0, subtotal - orderDiscount));
    const shipping = freeDelivery ? 0 : baseShipping;
    const total = round2(Math.max(0, afterDiscount - points + shipping));
    return { afterDiscount, shipping, shippingDiscount: round2(baseShipping - shipping), total };
  }
  let o = priceOrder({ subtotal: 30, promoDiscount: 3, baseShipping: 3 });
  o.total === 30 ? ok("pipeline: 30 - 3 discount + 3 shipping = 30") : no("pipeline pct", JSON.stringify(o));
  o = priceOrder({ subtotal: 30, freeDelivery: true, baseShipping: 3 });
  o.total === 30 && o.shipping === 0 && o.shippingDiscount === 3 ? ok("pipeline: free-delivery code zeroes shipping") : no("pipeline free ship", JSON.stringify(o));
  o = priceOrder({ subtotal: 30, promoDiscount: 999, baseShipping: 3 });
  o.total === 3 && o.afterDiscount === 0 ? ok("pipeline: over-large discount never makes total negative") : no("pipeline negative", JSON.stringify(o));

  // 18) usage recording is idempotent (retry/refresh safe) — UNIQUE(order_id)
  const recId = sqlite.prepare("SELECT id FROM promo_codes WHERE code='SAVE10'").get().id;
  const rec = () => {
    const res = sqlite.prepare("INSERT OR IGNORE INTO promo_code_uses (promo_code_id,promo_code,order_id,customer_email,discount_amount_jod) VALUES (?,?,?,?,?)")
      .run(recId, "SAVE10", 7777, "buyer@x.com", 3);
    if (Number(res.changes)) sqlite.prepare("UPDATE promo_codes SET used_count=used_count+1 WHERE id=?").run(recId);
  };
  rec(); rec(); rec(); // simulate a triple retry on the same order
  const useCount = sqlite.prepare("SELECT COUNT(*) AS n FROM promo_code_uses WHERE order_id=7777").get().n;
  const usedCol = sqlite.prepare("SELECT used_count FROM promo_codes WHERE id=?").get(recId).used_count;
  useCount === 1 && usedCol === 1 ? ok("duplicate order request records usage only once") : no("idempotent usage", `uses=${useCount} used_count=${usedCol}`);

  // 19) stock decrement guard never goes negative
  sqlite.prepare("UPDATE products SET stock_m=1 WHERE id=1").run();
  const dec = sqlite.prepare("UPDATE products SET stock_m=stock_m-?, stock=stock-? WHERE id=? AND stock_m>=?").run(2, 2, 1, 2);
  const stockLeft = sqlite.prepare("SELECT stock_m FROM products WHERE id=1").get().stock_m;
  Number(dec.changes) === 0 && stockLeft === 1 ? ok("stock decrement guard blocks overselling") : no("stock guard", `changes=${dec.changes} left=${stockLeft}`);

  // 20) analytics: delivered revenue excludes cancelled/unconfirmed; totals match stored orders
  sqlite.prepare("INSERT INTO orders (order_number,email,status,total,promo_code) VALUES ('VW-A','c1@x.com','Delivered',30,'SAVE10')").run();
  sqlite.prepare("INSERT INTO orders (order_number,email,status,total,promo_code) VALUES ('VW-B','c2@x.com','Pending',40,'SAVE10')").run();
  sqlite.prepare("INSERT INTO orders (order_number,email,status,total,promo_code) VALUES ('VW-C','c3@x.com','Cancelled',99,'SAVE10')").run();
  const placed = sqlite.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM orders WHERE promo_code='SAVE10' AND status!='Cancelled'").get();
  const delivered = sqlite.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM orders WHERE promo_code='SAVE10' AND status='Delivered'").get();
  placed.n === 2 && placed.rev === 70 ? ok("analytics: placed excludes cancelled (2 orders, 70 JD)") : no("placed rev", JSON.stringify(placed));
  delivered.n === 1 && delivered.rev === 30 ? ok("analytics: delivered revenue excludes unconfirmed/cancelled (1, 30 JD)") : no("delivered rev", JSON.stringify(delivered));

  // 21) old orders without a promo code still read fine
  sqlite.prepare("INSERT INTO orders (order_number,email,status,total) VALUES ('VW-LEGACY','old@x.com','Delivered',25)").run();
  const legacy = sqlite.prepare("SELECT promo_code, promo_code_id, total FROM orders WHERE order_number='VW-LEGACY'").get();
  (legacy.promo_code === "" || legacy.promo_code == null) && legacy.promo_code_id == null && legacy.total === 25
    ? ok("legacy order without promo still displays correctly") : no("legacy order", JSON.stringify(legacy));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
