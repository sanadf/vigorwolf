// POST /api/promo/validate  { code, items:[{productId, qty}], email?, city? }
// Preview a promo code for the cart. Prices/subtotal are resolved SERVER-SIDE
// (never trusted from the client); the final charge is revalidated in
// /api/orders/create. Returns the discount, free-delivery flag, and a delivery
// preview based on the global delivery setting.
import { json, fail, readJson } from "../_lib/http.js";
import { round2 } from "../_lib/loyalty.js";
import { validateAndComputePromo } from "../_lib/promo.js";
import { applyGlobalDelivery } from "../_lib/settings.js";
import { resolveShipping } from "../_lib/shipping.js";

export async function onRequestPost(context) {
  const { env } = context;
  const body = await readJson(context.request);
  const items = Array.isArray(body.items) ? body.items : [];
  const email = String(body.email || "").trim().toLowerCase();

  try {
    // Resolve trusted prices + subtotal.
    const resolved = [];
    for (const it of items) {
      const p = await env.DB.prepare(
        "SELECT id, price, sale_price FROM products WHERE id = ? AND hidden = 0"
      ).bind(it.productId).first();
      if (!p) continue;
      const unit = p.sale_price != null && p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price;
      resolved.push({ productId: p.id, price: unit, qty: Math.max(1, parseInt(it.qty, 10) || 1) });
    }
    const subtotal = round2(resolved.reduce((s, i) => s + i.price * i.qty, 0));

    const pv = await validateAndComputePromo(env, { code: body.code, subtotal, items: resolved, email });
    if (!pv.valid) return json({ ok: false, valid: false, error: pv.message });

    // Delivery preview (governorate base -> global setting -> free-delivery code).
    const ship = resolveShipping(body.city);
    const baseFee = ship.valid ? ship.fee : 0;
    const globalDelivery = await applyGlobalDelivery(env, baseFee, subtotal);
    const shipping = pv.freeDelivery ? 0 : globalDelivery.fee;

    return json({
      ok: true,
      valid: true,
      code: pv.promo.code,
      discountType: pv.discountType,
      discount: pv.discountAmount,
      freeDelivery: pv.freeDelivery,
      subtotal,
      shippingPreview: ship.valid ? shipping : null,
      message: pv.message,
    });
  } catch (err) {
    return fail("Could not validate promo code: " + err.message, 500);
  }
}
