// POST /api/auth/register  { name, email, password, phone?, city?, address? }
// Creates ONE real account in D1 (PBKDF2-hashed password, normalized unique email).
import { ok, fail, readJson, isEmail } from "../_lib/http.js";
import { hashPassword, createSession, userSessionCookie, TTL_USER } from "../_lib/auth.js";

const norm = (e) => String(e || "").trim().toLowerCase();

export async function onRequestPost(context) {
  const { env } = context;
  const b = await readJson(context.request);
  const name = String(b.name || "").trim();
  const email = norm(b.email);
  const password = String(b.password || "");

  if (!name) return fail("Please enter your name.");
  if (!isEmail(email)) return fail("Please enter a valid email.");
  if (password.length < 6) return fail("Password must be at least 6 characters.");

  try {
    const existing = await env.DB.prepare("SELECT id, password FROM users WHERE email = ?")
      .bind(email).first();
    const hash = await hashPassword(password);
    let userId;

    if (existing) {
      if (existing.password && existing.password.length) {
        // A real (password-holding) account already exists.
        return fail("An account with this email already exists. Please log in.", 409);
      }
      // Order/loyalty-created row with no password yet — claim it.
      await env.DB.prepare(
        "UPDATE users SET name = ?, password = ?, phone = ?, city = ?, address = ? WHERE id = ?"
      ).bind(name, hash, b.phone || "", b.city || "", b.address || "", existing.id).run();
      userId = existing.id;
    } else {
      const res = await env.DB.prepare(
        "INSERT INTO users (email, name, password, phone, city, address) VALUES (?,?,?,?,?,?)"
      ).bind(email, name, hash, b.phone || "", b.city || "", b.address || "").run();
      userId = res.meta.last_row_id;
    }

    const token = await createSession(env, { sub: userId, email, role: "customer" }, TTL_USER);
    return ok({ user: { name, email } }, { "Set-Cookie": userSessionCookie(token) });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return fail("An account with this email already exists. Please log in.", 409);
    }
    return fail("Could not create account: " + err.message, 500);
  }
}
