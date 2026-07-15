// Global store settings (key/value) — currently the delivery mode used to
// compute shipping server-side. The browser never decides delivery pricing.
import { round2 } from "./loyalty.js";

export const DELIVERY_MODES = ["normal", "free_all", "free_over_threshold"];

// Read all delivery-related settings with safe defaults (works even if the
// app_settings table/rows are missing, e.g. before the migration runs).
export async function getDeliverySettings(env) {
  let mode = "normal", threshold = 0;
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('delivery_mode','free_delivery_threshold')"
    ).all();
    for (const r of results || []) {
      if (r.key === "delivery_mode" && DELIVERY_MODES.includes(r.value)) mode = r.value;
      if (r.key === "free_delivery_threshold") threshold = Math.max(0, Number(r.value) || 0);
    }
  } catch {
    // table not present yet — fall back to normal delivery.
  }
  return { mode, threshold };
}

// Given the governorate base fee and the item subtotal, apply the GLOBAL
// delivery setting (before any promo code). Returns the base fee and the fee
// after the global rule. A free-delivery promo code is applied separately.
export async function applyGlobalDelivery(env, baseFee, subtotal) {
  const { mode, threshold } = await getDeliverySettings(env);
  let fee = round2(Math.max(0, baseFee));
  if (mode === "free_all") fee = 0;
  else if (mode === "free_over_threshold" && subtotal >= threshold && threshold >= 0) {
    // threshold of 0 in this mode means "free for everyone"; still explicit.
    fee = 0;
  }
  return { mode, threshold, baseFee: round2(Math.max(0, baseFee)), fee };
}
