// PATCH  /api/admin/coupons/:id  -> update coupon
// DELETE /api/admin/coupons/:id  -> delete coupon
import { ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

const MAP = {
  code: ["code", (v) => String(v).trim().toUpperCase()],
  type: ["type", (v) => (v === "fixed" ? "fixed" : "percentage")],
  value: ["value", (v) => Number(v) || 0],
  active: ["active", (v) => (v ? 1 : 0)],
  minOrderAmount: ["min_order_amount", (v) => Number(v) || 0],
  maxUses: ["max_uses", (v) => parseInt(v, 10) || 0],
  expiresAt: ["expires_at", (v) => String(v || "")],
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
  binds.push(params.id);
  try {
    await env.DB.prepare(`UPDATE coupons SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    return ok({ id: params.id });
  } catch (err) { return fail("Failed to update coupon: " + err.message, 500); }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    await env.DB.prepare("DELETE FROM coupons WHERE id = ?").bind(params.id).run();
    return ok({ deleted: params.id });
  } catch (err) { return fail("Failed to delete coupon: " + err.message, 500); }
}
