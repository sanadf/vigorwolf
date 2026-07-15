// GET   /api/admin/settings  -> current store settings (delivery mode)
// PATCH /api/admin/settings  { deliveryMode, freeDeliveryThreshold }
import { json, ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { getDeliverySettings, DELIVERY_MODES } from "../../_lib/settings.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const d = await getDeliverySettings(env);
    return json({ ok: true, deliveryMode: d.mode, freeDeliveryThreshold: d.threshold, modes: DELIVERY_MODES });
  } catch (err) { return fail("Failed to load settings: " + err.message, 500); }
}

async function put(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(key, String(value)).run();
}

export async function onRequestPatch(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  const b = await readJson(context.request);
  try {
    if (b.deliveryMode != null) {
      if (!DELIVERY_MODES.includes(b.deliveryMode)) return fail("Invalid delivery mode.");
      await put(env, "delivery_mode", b.deliveryMode);
    }
    if (b.freeDeliveryThreshold != null) {
      await put(env, "free_delivery_threshold", String(Math.max(0, Number(b.freeDeliveryThreshold) || 0)));
    }
    const d = await getDeliverySettings(env);
    return ok({ deliveryMode: d.mode, freeDeliveryThreshold: d.threshold });
  } catch (err) { return fail("Failed to update settings: " + err.message, 500); }
}
