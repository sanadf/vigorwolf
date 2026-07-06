// Optional email notifications. If no provider/key is configured, this is a
// no-op and the caller still persists everything to D1. Supports Resend and
// Web3Forms (both have free tiers). Configure via env vars — see README.

export async function sendNotification(env, { subject, text, replyTo }) {
  const provider = (env.EMAIL_PROVIDER || "").toLowerCase();
  const to = env.NOTIFY_EMAIL || "vigorwolf1@gmail.com";

  try {
    if (provider === "resend" && env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM || "VIGORWOLF <onboarding@resend.dev>",
          to: [to],
          subject,
          text,
          reply_to: replyTo || undefined,
        }),
      });
      return { sent: res.ok, provider: "resend" };
    }

    if (provider === "web3forms" && env.WEB3FORMS_KEY) {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: env.WEB3FORMS_KEY,
          subject,
          from_name: "VIGORWOLF Website",
          email: replyTo || to,
          message: text,
        }),
      });
      return { sent: res.ok, provider: "web3forms" };
    }
  } catch (err) {
    // Never let email failures break the order/signup flow.
    return { sent: false, error: String(err) };
  }
  return { sent: false, provider: "none" };
}
