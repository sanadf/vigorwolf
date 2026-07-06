// GET /api/admin/loyalty-transactions -> full loyalty ledger (joined to user email)
import { json, fail } from "../_lib/http.js";
import { requireAdmin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const { results } = await env.DB.prepare(
      `SELECT t.*, u.email AS user_email
       FROM loyalty_transactions t LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC LIMIT 200`
    ).all();
    return json({
      ok: true,
      transactions: (results || []).map((t) => ({
        id: t.id, userEmail: t.user_email || "", orderId: t.order_id,
        type: t.type, points: t.points, jdValue: t.jd_value,
        note: t.note, createdAt: t.created_at,
      })),
    });
  } catch (err) { return fail("Failed to load loyalty ledger: " + err.message, 500); }
}
