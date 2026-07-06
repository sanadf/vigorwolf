// POST /api/coupons/validate  { code, subtotal }
import { json, fail, readJson } from "../_lib/http.js";
import { validateCoupon } from "../_lib/loyalty.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { code, subtotal } = await readJson(context.request);
  try {
    const r = await validateCoupon(env, code, Number(subtotal) || 0);
    if (!r.valid) return json({ ok: false, valid: false, error: r.message });
    return json({
      ok: true, valid: true, discount: r.discount,
      code: r.coupon.code, type: r.coupon.type, value: r.coupon.value, message: r.message,
    });
  } catch (err) {
    return fail("Could not validate coupon: " + err.message, 500);
  }
}
