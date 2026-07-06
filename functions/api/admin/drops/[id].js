// PATCH /api/admin/drops/:id -> update drop
import { ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

const FIELD_MAP = {
  name: ["name", (v) => String(v)],
  description: ["description", (v) => String(v)],
  launchDate: ["launch_date", (v) => String(v)],
  countdownDate: ["countdown_date", (v) => String(v)],
  status: ["status", (v) => String(v)],
  heroText: ["hero_text", (v) => String(v)],
  featuredIds: ["featured_ids", (v) => JSON.stringify(Array.isArray(v) ? v : [])],
  isCurrent: ["is_current", (v) => (v ? 1 : 0)],
};

export async function onRequestPatch(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const b = await readJson(context.request);
  // If setting this drop current, clear others first.
  if (b.isCurrent) await env.DB.prepare("UPDATE drops SET is_current = 0").run();

  const sets = [], binds = [];
  for (const [key, val] of Object.entries(b)) {
    const map = FIELD_MAP[key];
    if (!map) continue;
    sets.push(`${map[0]} = ?`);
    binds.push(map[1](val));
  }
  if (!sets.length) return fail("No valid fields to update.");
  binds.push(params.id);

  try {
    await env.DB.prepare(`UPDATE drops SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    return ok({ id: params.id });
  } catch (err) {
    return fail("Failed to update drop: " + err.message, 500);
  }
}
