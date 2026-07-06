// POST /api/admin/login  { email, password }
//
// Robust login: the DB is the source of truth, but if the admin row is missing
// (fresh/unseeded DB) or you log in with the configured default credentials,
// the admin account is auto-created/repaired. Change the defaults via the
// ADMIN_EMAIL / ADMIN_PASSWORD environment variables (see README / wrangler.toml).
import { ok, fail, readJson } from "../_lib/http.js";
import { verifyPassword, hashPassword, createSession, sessionCookie } from "../_lib/auth.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { email, password } = await readJson(context.request);
  if (!email || !password) return fail("Email and password required.");

  const inEmail = String(email).trim().toLowerCase();
  const inPass = String(password);

  // Configured defaults (overridable in the Cloudflare dashboard).
  const DEFAULT_EMAIL = String(env.ADMIN_EMAIL || "admin@vigorwolf.com").toLowerCase();
  const DEFAULT_PASS = String(env.ADMIN_PASSWORD || "VigorWolfAdmin123");

  try {
    const user = await env.DB.prepare("SELECT * FROM admin_users WHERE email = ?")
      .bind(inEmail).first();

    // 1) Normal path: matching row + correct password.
    if (user && (await verifyPassword(inPass, user.password))) {
      return grant(env, user.id, user.email);
    }

    // 2) Self-heal path: default credentials always work and (re)seed the row.
    //    This covers unseeded DBs and lets you reset the admin by env vars.
    if (inEmail === DEFAULT_EMAIL && inPass === DEFAULT_PASS) {
      const hash = await hashPassword(DEFAULT_PASS);
      if (user) {
        await env.DB.prepare("UPDATE admin_users SET password = ? WHERE id = ?").bind(hash, user.id).run();
        return grant(env, user.id, user.email);
      }
      const res = await env.DB.prepare("INSERT INTO admin_users (email, password) VALUES (?, ?)")
        .bind(DEFAULT_EMAIL, hash).run();
      return grant(env, res.meta.last_row_id, DEFAULT_EMAIL);
    }

    return fail("Invalid credentials.", 401);
  } catch (err) {
    return fail("Login failed: " + err.message, 500);
  }
}

async function grant(env, id, email) {
  const token = await createSession(env, { sub: id, email, role: "admin" });
  return ok({ email }, { "Set-Cookie": sessionCookie(token) });
}
