// GET /api/drops           -> all drops
// GET /api/drops?current=1 -> the current/active drop only
import { json, fail, parseJsonField } from "../_lib/http.js";

export function serializeDrop(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    launchDate: row.launch_date,
    countdownDate: row.countdown_date,
    status: row.status,
    heroText: row.hero_text,
    featuredIds: parseJsonField(row.featured_ids, []),
    isCurrent: !!row.is_current,
    createdAt: row.created_at,
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("current")) {
      const row = await env.DB.prepare(
        "SELECT * FROM drops WHERE is_current = 1 ORDER BY id DESC LIMIT 1"
      ).first();
      return json({ ok: true, drop: row ? serializeDrop(row) : null });
    }
    const { results } = await env.DB.prepare(
      "SELECT * FROM drops ORDER BY id DESC"
    ).all();
    return json({ ok: true, drops: (results || []).map(serializeDrop) });
  } catch (err) {
    return fail("Failed to load drops: " + err.message, 500);
  }
}
