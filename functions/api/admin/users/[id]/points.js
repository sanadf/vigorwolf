// PATCH /api/admin/users/:id/points  { points, note }
// points is a signed integer: +add / -remove. Records an admin_adjustment.
import { ok, fail, readJson } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
import { pointsToJd } from "../../../_lib/loyalty.js";

export async function onRequestPatch(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  const { points, note } = await readJson(context.request);
  const delta = parseInt(points, 10);
  if (!Number.isFinite(delta) || delta === 0) return fail("Enter a non-zero points amount (use a minus sign to remove).");

  try {
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(params.id).first();
    if (!user) return fail("Customer not found.", 404);
    const newBalance = Math.max(0, user.points_balance + delta);
    await env.DB.prepare("UPDATE users SET points_balance = ? WHERE id = ?").bind(newBalance, user.id).run();
    await env.DB.prepare(
      "INSERT INTO loyalty_transactions (user_id, order_id, type, points, jd_value, note) VALUES (?,?,?,?,?,?)"
    ).bind(user.id, null, "admin_adjustment", delta, pointsToJd(Math.abs(delta)), note || "Manual adjustment").run();
    return ok({ id: user.id, pointsBalance: newBalance });
  } catch (err) { return fail("Failed to adjust points: " + err.message, 500); }
}
