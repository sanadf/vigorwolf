// GET /api/admin/me  -> current admin session (used to protect admin pages)
import { json } from "../_lib/http.js";
import { requireAdmin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireAdmin(context);
  if (!session) return json({ ok: false, authenticated: false }, 401);
  return json({ ok: true, authenticated: true, email: session.email });
}
