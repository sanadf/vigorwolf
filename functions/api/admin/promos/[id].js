// PATCH  /api/admin/promos/:id  -> update a promo code
// DELETE /api/admin/promos/:id  -> delete a promo code (usage ledger is kept)
import { ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { normalizeCode, PROMO_TYPES } from "../../_lib/promo.js";

const MAP = {
  code: ["code", (v) => normalizeCode(v)],
  campaignName: ["campaign_name", (v) => String(v || "")],
  influencerName: ["influencer_name", (v) => String(v || "")],
  description: ["description", (v) => String(v || "")],
  discountType: ["discount_type", (v) => (PROMO_TYPES.includes(v) ? v : "percentage")],
  discountValue: ["discount_value", (v) => Number(v) || 0],
  active: ["active", (v) => (v ? 1 : 0)],
  startsAt: ["starts_at", (v) => String(v || "")],
  expiresAt: ["expires_at", (v) => String(v || "")],
  maxUses: ["max_uses", (v) => parseInt(v, 10) || 0],
  perCustomerLimit: ["per_customer_limit", (v) => parseInt(v, 10) || 0],
  minOrderAmount: ["min_order_amount", (v) => Number(v) || 0],
  maxDiscountAmount: ["max_discount_amount", (v) => Number(v) || 0],
  productIds: ["product_ids", (v) => JSON.stringify(Array.isArray(v) ? v.map((x) => Number(x)).filter(Boolean) : [])],
  firstOrderOnly: ["first_order_only", (v) => (v ? 1 : 0)],
};

export async function onRequestPatch(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  const b = await readJson(context.request);
  const sets = [], binds = [];
  for (const [k, v] of Object.entries(b)) {
    if (!MAP[k]) continue;
    sets.push(`${MAP[k][0]} = ?`); binds.push(MAP[k][1](v));
  }
  if (!sets.length) return fail("No valid fields to update.");
  sets.push("updated_at = datetime('now')");
  binds.push(params.id);
  try {
    await env.DB.prepare(`UPDATE promo_codes SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    return ok({ id: params.id });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return fail("A promo code with that code already exists.");
    return fail("Failed to update promo code: " + err.message, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    await env.DB.prepare("DELETE FROM promo_codes WHERE id = ?").bind(params.id).run();
    return ok({ deleted: params.id });
  } catch (err) { return fail("Failed to delete promo code: " + err.message, 500); }
}
