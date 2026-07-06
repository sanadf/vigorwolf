// GET  /api/admin/coupons  -> list coupons
// POST /api/admin/coupons  -> create coupon
import { json, ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { serializeCoupon } from "../../_lib/loyalty.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const { results } = await env.DB.prepare("SELECT * FROM coupons ORDER BY id DESC").all();
    return json({ ok: true, coupons: (results || []).map(serializeCoupon) });
  } catch (err) { return fail("Failed to load coupons: " + err.message, 500); }
}

export async function onRequestPost(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  const b = await readJson(context.request);
  const code = String(b.code || "").trim().toUpperCase();
  if (!code) return fail("Coupon code is required.");
  const type = b.type === "fixed" ? "fixed" : "percentage";
  try {
    const res = await env.DB.prepare(
      `INSERT INTO coupons (code, type, value, active, min_order_amount, max_uses, expires_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(
      code, type, Number(b.value) || 0, b.active ? 1 : 0,
      Number(b.minOrderAmount) || 0, parseInt(b.maxUses, 10) || 0, b.expiresAt || ""
    ).run();
    return ok({ id: res.meta.last_row_id, code });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return fail("A coupon with that code already exists.");
    return fail("Failed to create coupon: " + err.message, 500);
  }
}
