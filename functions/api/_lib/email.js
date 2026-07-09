// Email helpers. Optional/non-blocking: if no provider/key is configured this
// is a no-op and the caller still succeeds. Supports Resend and Web3Forms.
//
// Configure via Cloudflare Pages env vars (Settings > Variables & Secrets):
//   EMAIL_PROVIDER   "resend" | "web3forms"   (var)
//   NOTIFY_EMAIL     vigorwolf1@gmail.com      (var, where ORDER alerts go)
//   RESEND_API_KEY   re_xxx                    (secret, if provider=resend)
//   RESEND_FROM      "VIGORWOLF <no-reply@yourdomain>"  (var, VERIFIED sender)
//   WEB3FORMS_KEY    xxxxxxxx                  (secret, if provider=web3forms)
//
// NOTE: Emails to CUSTOMERS (e.g. password reset) require Resend with a
// verified domain in RESEND_FROM. The default onboarding@resend.dev only
// delivers to your own Resend account address, so customer mail won't arrive
// until you verify a domain.

// Send to a specific recipient. Returns { sent, provider, ... }.
export async function sendEmail(env, { to, subject, text, html, replyTo }) {
  const provider = (env.EMAIL_PROVIDER || "").toLowerCase();
  const recipient = to || env.NOTIFY_EMAIL || "vigorwolf1@gmail.com";

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
          to: [recipient], subject, text, html: html || undefined, reply_to: replyTo || undefined,
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
      // Web3Forms delivers to the address tied to the key (can't target arbitrary
      // recipients) — fine for order alerts, not for customer emails.
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: env.WEB3FORMS_KEY, subject, from_name: "VIGORWOLF Website",
          email: replyTo || recipient, message: text,
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

  console.warn("[email] EMAIL_PROVIDER not set — email skipped.");
  return { sent: false, provider: "none" };
}

// Brand-facing notification (orders / contact / signups) -> NOTIFY_EMAIL.
export async function sendNotification(env, { subject, text, replyTo }) {
  return sendEmail(env, { to: env.NOTIFY_EMAIL || "vigorwolf1@gmail.com", subject, text, replyTo });
}
