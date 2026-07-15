// GET /api/settings — public, read-only store settings the storefront needs to
// render prices correctly (currently the global delivery mode). No secrets.
import { json, fail } from "../_lib/http.js";
import { getDeliverySettings } from "../_lib/settings.js";

export async function onRequestGet(context) {
  try {
    const d = await getDeliverySettings(context.env);
    return json({ ok: true, deliveryMode: d.mode, freeDeliveryThreshold: d.threshold });
  } catch (err) {
    return fail("Could not load settings: " + err.message, 500);
  }
}
