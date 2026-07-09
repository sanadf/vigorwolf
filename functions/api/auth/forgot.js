// POST /api/auth/forgot  { email }
// Emails a secure reset link IF the account exists. Always returns the SAME
// generic response so it never reveals whether an email is registered.
import { ok, fail, readJson, isEmail, siteUrl } from "../_lib/http.js";
import { sha256Hex } from "../_lib/auth.js";
import { sendEmail } from "../_lib/email.js";

// Professional, email-client-safe (table + inline styles) reset template.
function resetEmailHtml(name, link, ttlMin) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0b;font-family:Arial,Helvetica,sans-serif;color:#f5f5f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#121214;border:1px solid #232327;border-radius:10px;overflow:hidden">
        <tr><td style="padding:26px 30px;border-bottom:1px solid #232327">
          <span style="font-size:22px;font-weight:800;letter-spacing:2px;color:#ffffff">VIGORWOLF</span>
        </td></tr>
        <tr><td style="padding:30px">
          <h1 style="margin:0 0 14px;font-size:22px;color:#ffffff">Reset your password</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#c9c9cd">Hi ${name || "there"}, we received a request to reset your VIGORWOLF password. Tap the button below to choose a new one.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0">
            <tr><td style="border-radius:6px;background:#ffffff">
              <a href="${link}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;letter-spacing:1px;color:#0a0a0b;text-decoration:none;text-transform:uppercase">Reset Password</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#9a9a9e">This link expires in <strong style="color:#f5f5f4">${ttlMin} minutes</strong>.</p>
          <p style="margin:0 0 18px;font-size:13px;color:#9a9a9e">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          <p style="margin:0;font-size:12px;color:#6c6c72;word-break:break-all">Or paste this link into your browser:<br>${link}</p>
        </td></tr>
        <tr><td style="padding:18px 30px;border-top:1px solid #232327">
          <p style="margin:0;font-size:11px;color:#6c6c72">© ${new Date().getFullYear()} VIGORWOLF · Culture. Tribe. Lifestyle.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

const norm = (e) => String(e || "").trim().toLowerCase();
const GENERIC = "If an account exists for that email, a password reset link is on its way.";
const TTL_MIN = 60; // token valid for 60 minutes

export async function onRequestPost(context) {
  const { env, request } = context;
  const { email } = await readJson(request);
  const clean = norm(email);
  if (!isEmail(clean)) return fail("Please enter a valid email.");

  try {
    // Only real (password-holding) accounts can reset. Covers both the
    // canonical password_hash column and any not-yet-migrated legacy rows.
    const user = await env.DB.prepare(
      "SELECT id, name FROM users WHERE email = ? AND (password_hash != '' OR password != '')"
    ).bind(clean).first();

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

      // Opportunistic housekeeping: sweep stale rows from anyone who never
      // clicked their link. Runs after the response so it never adds latency.
      context.waitUntil(
        env.DB.prepare(
          "DELETE FROM password_resets WHERE datetime(created_at) < datetime('now', '-24 hours')"
        ).run()
      );

      const link = `${siteUrl(env, request)}/reset-password.html?token=${raw}`;
      // Send in the background so response timing is constant (no enumeration).
      context.waitUntil(sendEmail(env, {
        to: clean,
        subject: "Reset your VIGORWOLF password",
        html: resetEmailHtml(user.name, link, TTL_MIN),
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
