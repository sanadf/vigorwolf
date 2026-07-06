// Runs before every /api/* function. Normalizes the D1 binding to `env.DB`
// regardless of what the binding is named in wrangler.toml or the Cloudflare
// dashboard (e.g. "DB", "vigorwolf_db", ...). All route code uses `env.DB`.
export async function onRequest(context) {
  const { env } = context;
  if (!env.DB || typeof env.DB.prepare !== "function") {
    // Prefer a conventionally-named binding, then auto-detect any D1 binding.
    const candidate =
      (env.vigorwolf_db && typeof env.vigorwolf_db.prepare === "function" && env.vigorwolf_db) ||
      Object.values(env).find((b) => b && typeof b.prepare === "function");
    if (candidate) env.DB = candidate;
  }
  return context.next();
}
