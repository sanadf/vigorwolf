// GET  /api/admin/drops -> all drops
// POST /api/admin/drops -> create drop
import { json, ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { serializeDrop } from "../../drops/index.js";

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const { results } = await env.DB.prepare("SELECT * FROM drops ORDER BY id DESC").all();
    return json({ ok: true, drops: (results || []).map(serializeDrop) });
  } catch (err) {
    return fail("Failed to load drops: " + err.message, 500);
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  const b = await readJson(context.request);
  if (!b.name) return fail("Drop name is required.");
  const slug = (b.slug && slugify(b.slug)) || slugify(b.name) + "-" + Math.floor(Math.random() * 1000);

  try {
    // Only one drop may be "current".
    if (b.isCurrent) await env.DB.prepare("UPDATE drops SET is_current = 0").run();
    const res = await env.DB.prepare(
      `INSERT INTO drops (name, slug, description, launch_date, countdown_date, status, hero_text, featured_ids, is_current)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(
      String(b.name), slug, b.description || "", b.launchDate || "", b.countdownDate || "",
      b.status || "Coming Soon", b.heroText || "",
      JSON.stringify(Array.isArray(b.featuredIds) ? b.featuredIds : []), b.isCurrent ? 1 : 0
    ).run();
    return ok({ id: res.meta.last_row_id, slug });
  } catch (err) {
    return fail("Failed to create drop: " + err.message, 500);
  }
}
