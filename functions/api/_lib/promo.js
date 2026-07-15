// Promo-code validation + discount computation. ALL server-side — the client
// never decides code validity, discount, or delivery. Shared by the public
// /api/promo/validate endpoint and /api/orders/create so the "apply" preview
// and the final charged order use identical logic.
import { round2 } from "./loyalty.js";
import { parseJsonField } from "./http.js";

export const normalizeCode = (code) => String(code || "").trim().toUpperCase();

export const PROMO_TYPES = ["percentage", "fixed", "free_delivery"];

// Shape a DB row for admin/API responses (camelCase, parsed product list).
export function serializePromo(row) {
  return {
    id: row.id,
    code: row.code,
    campaignName: row.campaign_name || "",
    influencerName: row.influencer_name || "",
    description: row.description || "",
    discountType: row.discount_type,
    discountValue: row.discount_value,
    freeShipping: !!row.free_shipping,
    active: !!row.active,
    startsAt: row.starts_at || "",
    expiresAt: row.expires_at || "",
    maxUses: row.max_uses,
    perCustomerLimit: row.per_customer_limit,
    minOrderAmount: row.min_order_amount,
    maxDiscountAmount: row.max_discount_amount,
    productIds: parseJsonField(row.product_ids, []),
    firstOrderOnly: !!row.first_order_only,
    usedCount: row.used_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Which columns actually exist on promo_codes (so admin writes degrade
// gracefully if migration 0011's free_shipping column isn't present yet).
export async function promoColumnSet(env) {
  try {
    const { results } = await env.DB.prepare("PRAGMA table_info(promo_codes)").all();
    return new Set((results || []).map((r) => r.name));
  } catch { return new Set(); }
}

export async function getPromoByCode(env, code) {
  const norm = normalizeCode(code);
  if (!norm) return null;
  // Case-insensitive compare (codes are stored uppercase, but be defensive).
  return env.DB.prepare("SELECT * FROM promo_codes WHERE UPPER(code) = ?").bind(norm).first();
}

// How many times this email has already successfully used this code.
async function usesByEmail(env, promoId, email) {
  if (!email) return 0;
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM promo_code_uses WHERE promo_code_id = ? AND customer_email = ?"
  ).bind(promoId, String(email).toLowerCase()).first();
  return r?.n ?? 0;
}

// Has this email placed any prior (non-cancelled) order? Used for first_order_only.
async function hasPriorOrder(env, email) {
  if (!email) return false;
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE lower(email) = ? AND status != 'Cancelled'"
  ).bind(String(email).toLowerCase()).first();
  return (r?.n ?? 0) > 0;
}

// Core validator + calculator.
//   items: resolved cart items [{ productId, price, qty }]
//   subtotal: trusted item subtotal (JD)
//   email: customer email (for per-customer + first-order checks)
// Returns { valid, message, promo, discountType, discountAmount, freeDelivery }.
export async function validateAndComputePromo(env, { code, subtotal, items = [], email = "" }) {
  const promo = await getPromoByCode(env, code);
  if (!promo) return { valid: false, message: "That promo code isn’t valid." };

  const type = PROMO_TYPES.includes(promo.discount_type) ? promo.discount_type : "percentage";

  if (!promo.active) return { valid: false, message: "This promo code is no longer active." };

  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now)
    return { valid: false, message: "This promo code isn’t active yet." };
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now)
    return { valid: false, message: "This promo code has expired." };

  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses)
    return { valid: false, message: "This promo code has reached its usage limit." };

  if (promo.per_customer_limit > 0) {
    const used = await usesByEmail(env, promo.id, email);
    if (used >= promo.per_customer_limit)
      return { valid: false, message: "You’ve already used this promo code." };
  }

  if (promo.first_order_only && (await hasPriorOrder(env, email)))
    return { valid: false, message: "This promo code is for first orders only." };

  if (subtotal < (promo.min_order_amount || 0))
    return { valid: false, message: `Add ${round2(promo.min_order_amount - subtotal)} JD more to use this code (min ${promo.min_order_amount} JD).` };

  // Product restriction: discount base is limited to eligible items.
  const restrictIds = parseJsonField(promo.product_ids, []);
  let eligibleBase = subtotal;
  if (Array.isArray(restrictIds) && restrictIds.length) {
    const set = new Set(restrictIds.map((x) => Number(x)));
    eligibleBase = round2(items
      .filter((i) => set.has(Number(i.productId)))
      .reduce((s, i) => s + i.price * i.qty, 0));
    if (eligibleBase <= 0)
      return { valid: false, message: "This promo code doesn’t apply to the items in your cart." };
  }

  let discountAmount = 0;

  if (type === "percentage") {
    discountAmount = eligibleBase * (Math.max(0, promo.discount_value) / 100);
  } else if (type === "fixed") {
    discountAmount = Math.min(Math.max(0, promo.discount_value), eligibleBase);
  }

  // Optional max discount cap.
  if (promo.max_discount_amount > 0) discountAmount = Math.min(discountAmount, promo.max_discount_amount);
  // Never discount more than the subtotal (no negative subtotal).
  discountAmount = round2(Math.min(discountAmount, subtotal));

  // Free delivery when the type IS free_delivery, or the independent
  // free_shipping flag is set (e.g. an influencer code = discount + free ship).
  const freeDelivery = type === "free_delivery" || !!promo.free_shipping;

  const message = discountAmount > 0 && freeDelivery ? "Promo applied — discount + free delivery."
    : freeDelivery ? "Free delivery applied."
    : "Promo code applied.";

  return { valid: true, message, promo, discountType: type, discountAmount, freeDelivery };
}
