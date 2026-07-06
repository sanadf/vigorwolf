// PATCH /api/admin/orders/:id/status  { status }
import { ok, fail, readJson } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";

const ALLOWED = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

export async function onRequestPatch(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const { status } = await readJson(context.request);
  if (!ALLOWED.includes(status)) return fail("Invalid status.");

  try {
    await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
      .bind(status, params.id).run();
    return ok({ id: params.id, status });
  } catch (err) {
    return fail("Failed to update status: " + err.message, 500);
  }
}
