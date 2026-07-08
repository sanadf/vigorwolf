// POST /api/auth/login  { email, password }
// Verifies against the shared D1 users table (works from any device/browser).
import { ok, fail, readJson, isEmail } from "../_lib/http.js";
import { verifyPassword, createSession, userSessionCookie, TTL_USER } from "../_lib/auth.js";

const norm = (e) => String(e || "").trim().toLowerCase();

export async function onRequestPost(context) {
  const { env } = context;
  const b = await readJson(context.request);
  const email = norm(b.email);
  const password = String(b.password || "");
  if (!isEmail(email) || !password) return fail("Enter your email and password.");

  try {
    const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    // Same generic error whether the email is unknown or the password is wrong.
    if (!u || !u.password || !(await verifyPassword(password, u.password))) {
      return fail("Invalid email or password.", 401);
    }
    const token = await createSession(env, { sub: u.id, email: u.email, role: "customer" }, TTL_USER);
    return ok({ user: { name: u.name, email: u.email } }, { "Set-Cookie": userSessionCookie(token) });
  } catch (err) {
    return fail("Login failed: " + err.message, 500);
  }
}
