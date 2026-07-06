// GET /api/admin/signups            -> list signups
// GET /api/admin/signups?format=csv  -> CSV export download
import { json, fail } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  try {
    const { results } = await env.DB.prepare(
      "SELECT email, source, created_at FROM email_signups ORDER BY id DESC"
    ).all();
    const rows = results || [];

    if (url.searchParams.get("format") === "csv") {
      const header = "email,source,created_at\n";
      const body = rows.map((r) => `${r.email},${r.source || ""},${r.created_at}`).join("\n");
      return new Response(header + body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="vigorwolf-signups.csv"',
        },
      });
    }

    return json({
      ok: true,
      signups: rows.map((r) => ({ email: r.email, source: r.source, createdAt: r.created_at })),
    });
  } catch (err) {
    return fail("Failed to load signups: " + err.message, 500);
  }
}
