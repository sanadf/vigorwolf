// POST /api/signups  { email, source }  -> save newsletter/notify signup
import { ok, fail, readJson, isEmail } from "./_lib/http.js";
import { sendNotification } from "./_lib/email.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { email, source } = await readJson(context.request);

  if (!isEmail(email)) return fail("Please enter a valid email.");
  const clean = String(email).trim().toLowerCase();

  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM email_signups WHERE email = ?"
    ).bind(clean).first();

    if (existing) {
      return ok({ duplicate: true, message: "You're already in the Pack." });
    }

    await env.DB.prepare(
      "INSERT INTO email_signups (email, source) VALUES (?, ?)"
    ).bind(clean, source || "site").run();

    // Fire-and-forget notification (optional).
    context.waitUntil(
      sendNotification(env, {
        subject: "VIGORWOLF — new Pack signup",
        text: `New email signup: ${clean}\nSource: ${source || "site"}`,
        replyTo: clean,
      })
    );

    return ok({ duplicate: false, message: "You're in. The Pack moves first." });
  } catch (err) {
    return fail("Could not save signup: " + err.message, 500);
  }
}
