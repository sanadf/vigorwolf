// PATCH /api/auth/profile  { name?, phone?, city?, address? }
// Updates the signed-in customer's own record (email is not changeable here).
import { ok, fail, readJson } from "../_lib/http.js";
import { requireUser } from "../_lib/auth.js";

const FIELDS = { name: "name", phone: "phone", city: "city", address: "address" };

export async function onRequestPatch(context) {
  const { env } = context;
  const session = await requireUser(context);
  if (!session) return fail("You are not signed in.", 401);

  const b = await readJson(context.request);
  const sets = [], binds = [];
  for (const [key, col] of Object.entries(FIELDS)) {
    if (b[key] != null) { sets.push(`${col} = ?`); binds.push(String(b[key]).trim()); }
  }
  if (!sets.length) return fail("Nothing to update.");
  binds.push(session.sub);

  try {
    await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    return ok({ updated: true });
  } catch (err) {
    return fail("Could not save profile: " + err.message, 500);
  }
}
