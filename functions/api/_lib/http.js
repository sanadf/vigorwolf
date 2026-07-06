// Shared HTTP helpers for all VIGORWOLF API routes.
// Files/folders starting with "_" are ignored by the Pages Functions router,
// so this module is safe to import from route files.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

export const ok = (data = {}, headers = {}) => json({ ok: true, ...data }, 200, headers);
export const fail = (message, status = 400, extra = {}) =>
  json({ ok: false, error: message, ...extra }, status);

// Safely read a JSON body; returns {} if empty/invalid.
export async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

// Parse a `Cookie` header into a plain object.
export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > -1) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}

// Parse JSON columns coming out of D1 (they are stored as TEXT).
export function parseJsonField(value, fallback) {
  try {
    const v = JSON.parse(value);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
