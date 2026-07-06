// GET /api/admin/users -> customers with loyalty balances
import { json, fail } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { pointsToJd } from "../../_lib/loyalty.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM users ORDER BY points_balance DESC, id DESC"
    ).all();
    return json({
      ok: true,
      users: (results || []).map((u) => ({
        id: u.id, email: u.email, name: u.name,
        pointsBalance: u.points_balance, jdValue: pointsToJd(u.points_balance),
        createdAt: u.created_at,
      })),
    });
  } catch (err) { return fail("Failed to load customers: " + err.message, 500); }
}
