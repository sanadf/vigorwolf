// POST /api/auth/forgot  { email }
// Emails a secure reset link IF the account exists. Always returns the SAME
// generic response so it never reveals whether an email is registered.
import { ok, fail, readJson, isEmail } from "../_lib/http.js";
import { sha256Hex } from "../_lib/auth.js";
import { sendEmail } from "../_lib/email.js";

const norm = (e) => String(e || "").trim().toLowerCase();
const GENERIC = "If an account exists for that email, a password reset link is on its way.";
const TTL_MIN = 60; // token valid for 60 minutes

export async function onRequestPost(context) {
  const { env, request } = context;
  const { email } = await readJson(request);
  const clean = norm(email);
  if (!isEmail(clean)) return fail("Please enter a valid email.");

  try {
    // Only real (password-holding) accounts can reset.
    const user = await env.DB.prepare("SELECT id, name FROM users WHERE email = ? AND password != ''")
      .bind(clean).first();

    if (user) {
      // 32-byte random token; store only its SHA-256 hash.
      const raw = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256Hex(raw);
      const expires = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

      // One active token per user: clear any previous ones first.
      await env.DB.prepare("DELETE FROM password_resets WHERE user_id = ?").bind(user.id).run();
      await env.DB.prepare(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)"
      ).bind(user.id, tokenHash, expires).run();

      const origin = new URL(request.url).origin;
      const link = `${origin}/reset-password.html?token=${raw}`;
      // Send in the background so response timing is constant (no enumeration).
      context.waitUntil(sendEmail(env, {
        to: clean,
        subject: "VIGORWOLF — reset your password",
        text:
`Hi ${user.name || "there"},

We received a request to reset your VIGORWOLF password.
Reset it here (this link expires in ${TTL_MIN} minutes):

${link}

If you didn't request this, you can safely ignore this email — your password won't change.

— VIGORWOLF`,
      }));
    }

    return ok({ message: GENERIC });
  } catch (err) {
    // Even on error, don't leak details; log server-side.
    console.error("[forgot] error:", String(err));
    return ok({ message: GENERIC });
  }
}
