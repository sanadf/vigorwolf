// Loyalty + coupon rules, shared by checkout and admin routes.
// Rules: earn 100 points per 10 JD spent (= 10 pts / JD). 100 points = 1 JD.

export const POINTS_PER_JD_SPENT = 10;   // 100 points per 10 JD
export const POINTS_PER_JD_VALUE = 100;  // 100 points = 1 JD discount

export const pointsToJd = (points) => Math.max(0, points) / POINTS_PER_JD_VALUE;
export const earnedPointsFor = (amountJd) => Math.floor(Math.max(0, amountJd) * POINTS_PER_JD_SPENT);
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Fetch a customer's points balance by email (0 if unknown).
export async function getBalance(env, email) {
  if (!email) return { user: null, balance: 0 };
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase()).first();
  return { user: user || null, balance: user ? user.points_balance : 0 };
}

// Ensure a user row exists; returns its id.
export async function ensureUser(env, email, name) {
  const e = email.toLowerCase();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(e).first();
  if (existing) return existing.id;
  const res = await env.DB.prepare("INSERT INTO users (email, name) VALUES (?, ?)")
    .bind(e, name || "").run();
  return res.meta.last_row_id;
}

// Validate a coupon against a subtotal. Returns { valid, discount, coupon, message }.
export async function validateCoupon(env, code, subtotal) {
  if (!code) return { valid: false, discount: 0, coupon: null, message: "" };
  const c = await env.DB.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE")
    .bind(String(code).trim()).first();

  if (!c) return { valid: false, discount: 0, coupon: null, message: "Coupon not found." };
  if (!c.active) return { valid: false, discount: 0, coupon: null, message: "This coupon is inactive." };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now())
    return { valid: false, discount: 0, coupon: null, message: "This coupon has expired." };
  if (c.max_uses > 0 && c.used_count >= c.max_uses)
    return { valid: false, discount: 0, coupon: null, message: "This coupon has reached its usage limit." };
  if (subtotal < c.min_order_amount)
    return { valid: false, discount: 0, coupon: null,
             message: `Minimum order of ${c.min_order_amount} JD required for this coupon.` };

  let discount = c.type === "percentage" ? (subtotal * c.value) / 100 : c.value;
  discount = round2(Math.min(discount, subtotal)); // never exceed subtotal
  return { valid: true, discount, coupon: c, message: "Coupon applied." };
}

export function serializeCoupon(c) {
  return {
    id: c.id, code: c.code, type: c.type, value: c.value, active: !!c.active,
    minOrderAmount: c.min_order_amount, maxUses: c.max_uses, usedCount: c.used_count,
    expiresAt: c.expires_at, createdAt: c.created_at,
  };
}
