// GET  /api/admin/promos  -> list promo codes
// POST /api/admin/promos  -> create a promo code
import { json, ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { serializePromo, normalizeCode, PROMO_TYPES, promoColumnSet } from "../../_lib/promo.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const { results } = await env.DB.prepare("SELECT * FROM promo_codes ORDER BY id DESC").all();
    return json({ ok: true, promos: (results || []).map(serializePromo) });
  } catch (err) { return fail("Failed to load promo codes: " + err.message, 500); }
}

export async function onRequestPost(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  const b = await readJson(context.request);
  const code = normalizeCode(b.code);
  if (!code) return fail("Promo code is required.");
  const type = PROMO_TYPES.includes(b.discountType) ? b.discountType : "percentage";
  const productIds = Array.isArray(b.productIds) ? JSON.stringify(b.productIds.map((x) => Number(x)).filter(Boolean)) : "[]";
  try {
    const cols = ["code", "campaign_name", "influencer_name", "description", "discount_type", "discount_value",
      "active", "starts_at", "expires_at", "max_uses", "per_customer_limit", "min_order_amount",
      "max_discount_amount", "product_ids", "first_order_only"];
    const vals = [code, String(b.campaignName || ""), String(b.influencerName || ""), String(b.description || ""),
      type, Number(b.discountValue) || 0, b.active ? 1 : 0, String(b.startsAt || ""), String(b.expiresAt || ""),
      parseInt(b.maxUses, 10) || 0, parseInt(b.perCustomerLimit, 10) || 0, Number(b.minOrderAmount) || 0,
      Number(b.maxDiscountAmount) || 0, productIds, b.firstOrderOnly ? 1 : 0];
    if ((await promoColumnSet(env)).has("free_shipping")) {
      cols.push("free_shipping"); vals.push(b.freeShipping ? 1 : 0);
    }
    const res = await env.DB.prepare(
      `INSERT INTO promo_codes (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(",")})`
    ).bind(...vals).run();
    return ok({ id: res.meta.last_row_id, code });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return fail("A promo code with that code already exists.");
    return fail("Failed to create promo code: " + err.message, 500);
  }
}
