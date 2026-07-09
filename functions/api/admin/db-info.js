// GET /api/admin/db-info  (admin-only)
// Confirms which database + environment the deployed code is actually talking to,
// so you can verify you're on the real production D1 (not a local/simulated DB).
import { json, fail, siteUrl } from "../_lib/http.js";
import { requireAdmin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const host = new URL(request.url).hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  const one = async (sql) => (await env.DB.prepare(sql).first())?.n ?? 0;

  try {
    const users = await one("SELECT COUNT(*) AS n FROM users");
    const accounts = await one("SELECT COUNT(*) AS n FROM users WHERE password_hash != '' OR password != ''");
    const products = await one("SELECT COUNT(*) AS n FROM products");
    const orders = await one("SELECT COUNT(*) AS n FROM orders");

    return json({
      ok: true,
      environment: isLocal ? "local (Miniflare)" : (env.ENVIRONMENT || "production/preview"),
      hostname: host,
      siteUrl: siteUrl(env, request),
      resendFrom: env.RESEND_FROM || "onboarding@resend.dev (default — verify a domain for customer emails)",
      isLocal,
      database: { driver: "cloudflare-d1", bound: !!env.DB, name: "vigorwolf-db" },
      counts: { users, registeredAccounts: accounts, products, orders },
      emailProvider: env.EMAIL_PROVIDER || "(none)",
      time: new Date().toISOString(),
    });
  } catch (err) {
    return fail("db-info failed: " + err.message, 500);
  }
}
