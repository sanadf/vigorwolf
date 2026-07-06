// POST /api/contact  { name, email, message }
import { ok, fail, readJson, isEmail } from "./_lib/http.js";
import { sendNotification } from "./_lib/email.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { name, email, message } = await readJson(context.request);

  if (!name || !String(name).trim()) return fail("Name is required.");
  if (!isEmail(email)) return fail("Please enter a valid email.");
  if (!message || !String(message).trim()) return fail("Message is required.");

  try {
    await env.DB.prepare(
      "INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)"
    ).bind(String(name).trim(), String(email).trim().toLowerCase(), String(message).trim()).run();

    context.waitUntil(
      sendNotification(env, {
        subject: `VIGORWOLF — contact from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        replyTo: String(email).trim(),
      })
    );

    return ok({ message: "Message sent. Support will reply soon." });
  } catch (err) {
    return fail("Could not send message: " + err.message, 500);
  }
}
