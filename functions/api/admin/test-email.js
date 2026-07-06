// POST /api/admin/test-email  -> sends a test notification to NOTIFY_EMAIL.
// Admin-protected. Returns the provider result so the dashboard can show it.
import { json, fail } from "../_lib/http.js";
import { requireAdmin } from "../_lib/auth.js";
import { sendNotification } from "../_lib/email.js";

export async function onRequestPost(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const to = env.NOTIFY_EMAIL || "vigorwolf1@gmail.com";
  const provider = (env.EMAIL_PROVIDER || "").toLowerCase() || "(none)";
  const result = await sendNotification(env, {
    subject: "VIGORWOLF — test email ✅",
    text: `This is a test from your VIGORWOLF admin dashboard.\nIf you received this, order notifications will work.\nProvider: ${provider}\nTime: ${new Date().toISOString()}`,
    replyTo: to,
  });

  return json({
    ok: true,
    provider,
    notifyEmail: to,
    sent: !!result.sent,
    detail: result.error || result.detail || (result.sent ? "delivered to provider" : "not sent"),
    hint: result.sent
      ? `Check the inbox of ${to} (and spam).`
      : "Set EMAIL_PROVIDER + the matching key in Cloudflare Pages > Settings > Variables, then redeploy.",
  });
}
