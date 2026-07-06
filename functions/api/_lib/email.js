// Optional email notifications. If no provider/key is configured this is a
// no-op and the caller still persists everything to D1 (email never blocks an
// order). Supports Resend and Web3Forms. Failures are logged, never thrown.
//
// Configure via Cloudflare Pages env vars (Settings > Variables & Secrets):
//   EMAIL_PROVIDER   "resend" | "web3forms"   (var)
//   NOTIFY_EMAIL     vigorwolf1@gmail.com      (var, where orders are sent)
//   RESEND_API_KEY   re_xxx                    (secret, if provider=resend)
//   RESEND_FROM      "VIGORWOLF <orders@yourdomain>"  (var, verified sender)
//   WEB3FORMS_KEY    xxxxxxxx                  (secret, if provider=web3forms)

export async function sendNotification(env, { subject, text, replyTo }) {
  const provider = (env.EMAIL_PROVIDER || "").toLowerCase();
  const to = env.NOTIFY_EMAIL || "vigorwolf1@gmail.com";

  try {
    if (provider === "resend") {
      if (!env.RESEND_API_KEY) {
        console.error("[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is missing");
        return { sent: false, provider: "resend", error: "missing RESEND_API_KEY" };
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.RESEND_FROM || "VIGORWOLF <onboarding@resend.dev>",
          to: [to], subject, text, reply_to: replyTo || undefined,
        }),
      });
      const body = await res.text();
      if (!res.ok) console.error(`[email] resend failed ${res.status}: ${body}`);
      return { sent: res.ok, provider: "resend", status: res.status, detail: res.ok ? undefined : body };
    }

    if (provider === "web3forms") {
      if (!env.WEB3FORMS_KEY) {
        console.error("[email] EMAIL_PROVIDER=web3forms but WEB3FORMS_KEY is missing");
        return { sent: false, provider: "web3forms", error: "missing WEB3FORMS_KEY" };
      }
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: env.WEB3FORMS_KEY, subject, from_name: "VIGORWOLF Website",
          email: replyTo || to, message: text,
        }),
      });
      const body = await res.text();
      if (!res.ok) console.error(`[email] web3forms failed ${res.status}: ${body}`);
      return { sent: res.ok, provider: "web3forms", status: res.status, detail: res.ok ? undefined : body };
    }
  } catch (err) {
    console.error("[email] send threw:", String(err));
    return { sent: false, provider, error: String(err) };
  }

  // No provider configured — order still saved; just no email.
  console.warn("[email] EMAIL_PROVIDER not set — notification skipped (order was saved).");
  return { sent: false, provider: "none" };
}
