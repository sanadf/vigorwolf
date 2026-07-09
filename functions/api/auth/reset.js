// POST /api/auth/reset  { token, password }
// Verifies a reset token (by hash + expiry), sets a new PBKDF2 password, clears
// all of that user's reset tokens, and signs the customer in.
import { ok, fail, readJson } from "../_lib/http.js";
import { sha256Hex, hashPassword, createSession, userSessionCookie, TTL_USER } from "../_lib/auth.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { token, password } = await readJson(context.request);
  if (!token) return fail("Invalid reset link.", 400);
  if (String(password || "").length < 6) return fail("Password must be at least 6 characters.");

  try {
    const tokenHash = await sha256Hex(String(token));
    const row = await env.DB.prepare("SELECT * FROM password_resets WHERE token_hash = ?")
      .bind(tokenHash).first();

    if (!row) return fail("This reset link is invalid or has already been used.", 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(row.user_id).run();
      return fail("This reset link has expired. Please request a new one.", 400);
    }

    const user = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?").bind(row.user_id).first();
    if (!user) return fail("Account not found.", 400);

    const hash = await hashPassword(String(password));
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, user.id).run();
    // Clear all reset tokens for this user (single-use).
    await env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(user.id).run();

    // Sign them in with a fresh session.
    const session = await createSession(env, { sub: user.id, email: user.email, role: "customer" }, TTL_USER);
    return ok({ message: "Password updated.", user: { email: user.email } }, { "Set-Cookie": userSessionCookie(session) });
  } catch (err) {
    return fail("Could not reset password: " + err.message, 500);
  }
}
