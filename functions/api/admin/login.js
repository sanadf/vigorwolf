// POST /api/admin/login  { email, password }
import { ok, fail, readJson } from "../_lib/http.js";
import { verifyPassword, createSession, sessionCookie } from "../_lib/auth.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { email, password } = await readJson(context.request);
  if (!email || !password) return fail("Email and password required.");

  try {
    const user = await env.DB.prepare(
      "SELECT * FROM admin_users WHERE email = ?"
    ).bind(String(email).trim().toLowerCase()).first();

    if (!user || !(await verifyPassword(password, user.password))) {
      return fail("Invalid credentials.", 401);
    }

    const token = await createSession(env, { sub: user.id, email: user.email, role: "admin" });
    return ok({ email: user.email }, { "Set-Cookie": sessionCookie(token) });
  } catch (err) {
    return fail("Login failed: " + err.message, 500);
  }
}
