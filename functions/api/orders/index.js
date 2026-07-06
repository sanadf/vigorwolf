// GET /api/orders?number=VW-...   -> single order (confirmation page)
// GET /api/orders?email=a@b.com   -> orders for a user account (order history)
import { json, fail, ok } from "../_lib/http.js";

async function withItems(env, order) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM order_items WHERE order_id = ?"
  ).bind(order.id).all();
  return {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    phone: order.phone,
    email: order.email,
    city: order.city,
    address: order.address,
    notes: order.notes,
    paymentMethod: order.payment_method,
    status: order.status,
    subtotal: order.subtotal,
    couponCode: order.coupon_code,
    couponDiscount: order.coupon_discount_jd,
    pointsRedeemed: order.points_redeemed,
    pointsDiscount: order.points_discount_jd,
    pointsEarned: order.points_earned,
    shipping: order.shipping_jd,
    total: order.total,
    createdAt: order.created_at,
    items: (results || []).map((i) => ({
      name: i.name, price: i.price, size: i.size, color: i.color, qty: i.qty, image: i.image_url,
    })),
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const number = url.searchParams.get("number");
  const email = url.searchParams.get("email");

  try {
    if (number) {
      const row = await env.DB.prepare(
        "SELECT * FROM orders WHERE order_number = ?"
      ).bind(number).first();
      if (!row) return fail("Order not found", 404);
      return json({ ok: true, order: await withItems(env, row) });
    }
    if (email) {
      const { results } = await env.DB.prepare(
        "SELECT * FROM orders WHERE email = ? OR user_email = ? ORDER BY id DESC"
      ).bind(email.toLowerCase(), email.toLowerCase()).all();
      const orders = [];
      for (const r of results || []) orders.push(await withItems(env, r));
      return json({ ok: true, orders });
    }
    return fail("Provide ?number= or ?email=", 400);
  } catch (err) {
    return fail("Failed to load order: " + err.message, 500);
  }
}
