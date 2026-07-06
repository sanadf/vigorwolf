// GET /api/admin/orders?q=&status=  -> all orders (with items), searchable/filterable
import { json, fail } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const status = (url.searchParams.get("status") || "").trim();

  try {
    let sql = "SELECT * FROM orders";
    const where = [];
    const binds = [];
    if (status) { where.push("status = ?"); binds.push(status); }
    if (q) {
      where.push("(LOWER(order_number) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?)");
      const like = `%${q}%`;
      binds.push(like, like, like, like);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY id DESC";

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    const orders = [];
    for (const o of results || []) {
      const items = await env.DB.prepare(
        "SELECT name, price, size, color, qty, image_url FROM order_items WHERE order_id = ?"
      ).bind(o.id).all();
      orders.push({
        id: o.id, orderNumber: o.order_number, customerName: o.customer_name,
        phone: o.phone, email: o.email, city: o.city, address: o.address,
        notes: o.notes, paymentMethod: o.payment_method, status: o.status,
        subtotal: o.subtotal, total: o.total, createdAt: o.created_at,
        couponCode: o.coupon_code, couponDiscount: o.coupon_discount_jd,
        pointsRedeemed: o.points_redeemed, pointsDiscount: o.points_discount_jd, pointsEarned: o.points_earned,
        shipping: o.shipping_jd, emailStatus: o.email_status || "",
        items: (items.results || []).map((i) => ({
          name: i.name, price: i.price, size: i.size, color: i.color, qty: i.qty, image: i.image_url,
        })),
      });
    }
    return json({ ok: true, orders });
  } catch (err) {
    return fail("Failed to load orders: " + err.message, 500);
  }
}
