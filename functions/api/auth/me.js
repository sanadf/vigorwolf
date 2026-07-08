// GET /api/auth/me  -> the signed-in customer's profile (from the session cookie)
import { json } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const { env } = context;
  const session = await requireUser(context);
  if (!session) return json({ ok: false, authenticated: false }, 401);

  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(session.sub).first();
  if (!u) return json({ ok: false, authenticated: false }, 401);

  return json({
    ok: true,
    authenticated: true,
    user: {
      email: u.email, name: u.name || "",
      phone: u.phone || "", city: u.city || "", address: u.address || "",
      points: u.points_balance || 0,
    },
  });
}
